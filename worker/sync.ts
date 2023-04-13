import { IDomain, IProject, PROJECT_STATUS } from "@brimble/models";
import axios from "axios";
import fs from "fs";
import { Project } from "@brimble/models";
import { prioritize, proxy, useRabbitMQ } from "../config";
import { QueueClass } from "../queue";
import { Job, UnrecoverableError } from "bullmq";
import { LeanDocument } from "mongoose";

const keepInSyncWorker = async (job: Job) => {
  const { id, all } = job.data;

  try {
    if (!id || id === "undefined") return;

    const project = await Project.findById(id).populate(["domains", "log"]);

    if (!project) return;

    const { domains, port, dir, name, log, repo, lastProcessed } = project;

    const shouldStart = await starter({
      domains,
      port,
      dir,
      name,
      log,
      id,
      repo,
    });
    if (!shouldStart) return;
    if (all) {
      const now = Date.now();
      const timeElapsed = now - (lastProcessed || 0);
      if (timeElapsed < 1000 * 60 * 30) return;

      await Project.updateOne(
        { _id: id },
        { lastProcessed: now },
        { timestamps: false }
      );
    }

    return useRabbitMQ(
      "main",
      "send",
      JSON.stringify({
        event: "redeploy",
        data: {
          projectId: id,
          upKeep: true,
          redeploy: typeof shouldStart === "object" ? true : false,
          priority: prioritize.indexOf(name) + 1,
        },
      })
    );
  } catch (error: any) {
    console.error(error.message);
    throw new UnrecoverableError(error.message);
  }
};

export const projectSync = new QueueClass("project-sync", keepInSyncWorker);

export const keepInSync = async ({ all }: { all: boolean }) => {
  const projects = await Project.find();
  const data = projects
    .sort((a, b) => {
      const aIndex = prioritize.indexOf(a.name);
      const bIndex = prioritize.indexOf(b.name);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) {
        return -1;
      }
      if (bIndex !== -1) {
        return 1;
      }
      return Number(b.createdAt) - Number(a.createdAt);
    })
    .map((project: LeanDocument<IProject>) => ({
      data: { id: project._id, all },
    }));

  await projectSync.executeBulk(data);
};

const starter = async (data: any) => {
  const { domains, port, dir, name, repo } = data;

  if (!name) return false;

  const urlString = `http://127.0.0.1:${port}`;

  try {
    await axios(urlString);

    domains.forEach((domain: IDomain) => {
      proxy.register(domain.name, urlString, { isWatchMode: true });
      useRabbitMQ(
        "main",
        "send",
        JSON.stringify({
          event: "domain:clear_cache",
          data: { domain: domain.name },
        })
      );
    });
    return false;
  } catch (error) {
    if (!dir) {
      return repo && repo.installationId ? { redeploy: true } : false;
    } else if (!fs.existsSync(dir)) {
      return repo && repo.installationId ? { redeploy: true } : false;
    }
    return true;
  }
};
