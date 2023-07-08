import { IProject } from "@brimble/models";
import axios from "axios";
import { Project } from "@brimble/models";
import { prioritize, useRabbitMQ } from "../config";
import { QueueClass } from "../queue";
import { Job, UnrecoverableError } from "bullmq";

const projs: string[] = [];
const keepInSyncWorker = async (job: Job) => {
  const { id, checkLast } = job.data;

  try {
    if (!id || id === "undefined") return;

    const project = await Project.findById(id).populate({
      path: "domains",
      select: "name ssl",
    });

    if (!project) return;

    const { name, lastProcessed } = project;

    const shouldStart = await starter(project);
    if (!shouldStart) return;
    if (checkLast && !prioritize.includes(name)) {
      const now = Date.now();
      const timeElapsed = now - (lastProcessed || 0);
      if (timeElapsed < 1000 * 60 * 60 * 24) return;

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
  } catch (error: any) {
    console.error(error.message);
    throw new UnrecoverableError(error.message);
  }
};

export const projectSync = new QueueClass("project-sync", keepInSyncWorker);

export const keepInSync = async (opt?: { checkLast?: boolean }) => {
  if (opt?.checkLast)
    console.info(`Running keepInSync with checkLast: ${opt?.checkLast}`);
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
      const shouldStart = await starter(project);
      if (shouldStart) {
        projs.push(project.name);
      }
      return { data: { id: project._id, checkLast: opt?.checkLast } };
    });

  await Promise.all(data).then(async (d) => {
    await projectSync.executeBulk(d.map((d) => ({ data: d.data })));
  });
};

const starter = async (data: any) => {
  const { _id, port, name, status, ip } = data;

  if (!name) return false;

  const urlString = `http://${ip}:${port}`;

  try {
    await axios(urlString, { timeout: 60000 });

    await Project.updateOne(
      { _id },
      { lastProcessed: 0 },
      { timestamps: false }
    );
    return false;
  } catch (error: any) {
    if (error.code === "ECONNABORTED" || error.message === "timeout") {
      return false;
    } else {
      if (status === "FAILED") return false;

      return true;
    }
  }
};
