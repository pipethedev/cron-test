import { IDomain, IProject } from "@brimble/models";
import axios from "axios";
import fs from "fs";
import { Project } from "@brimble/models";
import { PORT, prioritize, proxy, useRabbitMQ } from "../config";
import { QueueClass } from "../queue";
import { Job, UnrecoverableError } from "bullmq";
import { log } from "@brimble/utils";

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
      if (
        (typeof shouldStart === "object" &&
          shouldStart.redeploy &&
          timeElapsed < 1000 * 60 * 30) ||
        (typeof shouldStart === "boolean" && timeElapsed < 1000 * 60 * 5)
      ) {
        return;
      }

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
    log.error(error.message);
    throw new UnrecoverableError(error.message);
  }
};

export const projectSync = new QueueClass("project-sync", keepInSyncWorker);

export const keepInSync = async (opt?: { checkLast?: boolean }) => {
  if (opt?.checkLast)
    log.info(`Running keepInSync with checkLast: ${opt?.checkLast}`);
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
  const { domains, port, dir, name, repo, passwordEnabled } = data;

  if (!name) return false;

  const urlString = `http://127.0.0.1:${port}`;

  try {
    await axios(urlString, { timeout: 60000 });

    domains.forEach((domain: IDomain) => {
      if (domain.name.endsWith(".brimble.app") || domain.ssl?.enabled) {
        proxy.unregister(domain.name);
        proxy.register(
          domain.name,
          passwordEnabled ? `http://127.0.0.1:${PORT.app}` : urlString,
          { isWatchMode: true }
        );
      }
    });
    return false;
  } catch (error) {
    if (!dir || !fs.existsSync(dir)) {
      return repo && repo.installationId ? { redeploy: true } : false;
    }
    return true;
  }
};
