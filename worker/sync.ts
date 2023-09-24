import { IProject } from "@brimble/models";
import axios from "axios";
import { Project, Domain } from "@brimble/models";
import { prioritize, useRabbitMQ } from "../config";
import { QueueClass } from "../queue";
import { Job, UnrecoverableError } from "bullmq";

const projs: string[] = [];
const keepInSyncWorker = async (job: Job) => {
  const { id, lastChecked } = job.data;

  try {
    if (!id || id === "undefined") return;

    const project = await Project.findById(id).populate("server");

    if (!project) return;

    const { name, lastProcessed } = project;

    const shouldStart = await starter(project, {
      timestamp: lastProcessed,
      lastChecked,
    });
    if (shouldStart) {
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
  const projects = await Project.find().populate("server");
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
      return { data: { id: project._id, lastChecked: opt?.lastChecked } };
    });

  await Promise.all(data).then(async (d) => {
    await projectSync.executeBulk(d.map((d) => ({ data: d.data })));
  });
};

const starter = async (
  data: any,
  opt: { timestamp?: number; lastChecked?: boolean } = {}
) => {
  const { _id, port, name, status, ip } = data;

  if (!name) return false;
  try {
    if (!ip || !port) throw new Error("Missing ip or port");

    const urlString = `http://${ip}:${port}`;

    await axios(urlString, { timeout: 60000 });

    const domains = await Domain.find({ project: _id });
    if (domains.length !== data.domains.length) {
      domains.forEach((domain) => {
        return useRabbitMQ(
          "proxy",
          "send",
          JSON.stringify({
            event: "domain:map",
            data: {
              domain: domain.name,
              uri: !data.passwordEnabled && `${data.ip}:${data.port}`,
              host: data.server.name,
            },
          })
        );
      });
      data.domains = domains;
    }

    await Project.updateOne(
      { _id },
      { lastProcessed: 0, domains: data.domains },
      { timestamps: false }
    );
    return false;
  } catch (error: any) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return false;
    } else if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
      if (opt.lastChecked && status === "FAILED") return false;
      return true;
    }
  }
};
