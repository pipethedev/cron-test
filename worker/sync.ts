import { IProject } from "@brimble/models";
import axios from "axios";
import { Project } from "@brimble/models";
import { prioritize, useRabbitMQ } from "../config";
import { QueueClass } from "../queue";
import { Job, UnrecoverableError } from "bullmq";
import { captureException } from "@sentry/node";
import moment from "moment";

const projs: string[] = [];
const keepInSyncWorker = async (job: Job) => {
  const { id, lastChecked } = job.data;

  try {
    if (!id || id === "undefined") return;

    const project = await Project.findById(id).populate({
      path: "domains",
      select: "name ssl",
    });

    if (!project) return;

    const { name, lastProcessed } = project;

    const shouldStart = await starter(project, {
      timestamp: lastProcessed,
      capture: true,
    });
    if (shouldStart) {
      if (lastChecked && !prioritize.includes(name)) {
        const now = Date.now();
        const timeElapsed = lastProcessed ? now - lastProcessed : 0;
        if (timeElapsed < 1000 * 60 * 5) return;

        await Project.updateOne(
          { _id: id },
          { lastProcessed: now },
          { timestamps: false }
        );
      }

      const filterPriority = prioritize.filter((p) => projs.includes(p));
      const priority = filterPriority ? filterPriority.indexOf(name) + 1 : 0;

      return useRabbitMQ(
        "main",
        "send",
        JSON.stringify({
          event: "redeploy",
          data: {
            projectId: id,
            upKeep: true,
            redeploy: typeof shouldStart === "object" ? true : false,
            priority,
          },
        })
      );
    }
  } catch (error: any) {
    console.error(error.message);
    throw new UnrecoverableError(error.message);
  }
};

export const projectSync = new QueueClass("project-sync", keepInSyncWorker);

export const keepInSync = async (opt?: { lastChecked?: boolean }) => {
  if (opt?.lastChecked)
    console.info(`Running keepInSync with lastChecked: ${opt?.lastChecked}`);
  const projects = await Project.find().populate({
    path: "domains",
    select: "name ssl",
  });
  projs.length = 0;
  const data = projects
    .sort((a, b) => {
      const aIndex = prioritize.indexOf(a.name);
      const bIndex = prioritize.indexOf(b.name);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return Number(b.createdAt) - Number(a.createdAt);
    })
    .map(async (project: IProject) => {
      const shouldStart = await starter(project, { capture: false });
      if (shouldStart) {
        projs.push(project.name);
      }
      return { data: { id: project._id, lastChecked: opt?.lastChecked } };
    });

  await Promise.all(data).then(async (d) => {
    await projectSync.executeBulk(d.map((d) => ({ data: d.data })));
  });
};

const starter = async (
  data: any,
  opt: { timestamp?: number; capture?: boolean } = {}
) => {
  const { _id, port, name, status, ip } = data;

  if (!name) return false;
  try {
    if (!ip || !port) throw new Error("Missing ip or port");

    const urlString = `http://${ip}:${port}`;

    await axios(urlString, { timeout: 60000 });

    await Project.updateOne(
      { _id },
      { lastProcessed: 0 },
      { timestamps: false }
    );
    return false;
  } catch (error: any) {
    if (opt.capture) {
      captureException(new Error(`🚨 Project ${name} not running 🚨`), {
        tags: {
          project: name,
          status,
          error_code: error.code,
          error_message: error.message,
          last_checked: opt.timestamp && `${moment(opt.timestamp).fromNow()}`,
        },
      });
    }
    if (error.code === "ECONNABORTED" || error.message === "timeout") {
      return false;
    } else {
      if (status === "FAILED") return false;

      return true;
    }
  }
};
