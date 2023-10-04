import axios, { AxiosError } from "axios";
import {
  Project,
  PROJECT_STATUS,
  IProject,
  Preview,
  IPreview,
} from "@brimble/models";
import { prioritize, randomDelay, useRabbitMQ } from "../config";
import { log } from "@brimble/utils";

type IOpt = { lastChecked?: boolean };

const done: string[] = [];
const pr_done: string[] = [];

const processProject = async (opt: IOpt = {}) => {
  const projects = await Project.find().select([
    "port",
    "name",
    "status",
    "ip",
    "repo",
  ]);

  projects.sort((a, b) => {
    const aIndex = prioritize.indexOf(a.name);
    const bIndex = prioritize.indexOf(b.name);
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    if (
      a.status === PROJECT_STATUS.ACTIVE &&
      b.status === PROJECT_STATUS.FAILED
    ) {
      return -1; // a comes before b
    } else if (
      a.status === PROJECT_STATUS.FAILED &&
      b.status === PROJECT_STATUS.ACTIVE
    ) {
      return 1; // b comes before a
    } else {
      return Number(b.createdAt) - Number(a.createdAt);
    }
  });
  const tops = [];

  for (const project of projects) {
    const shouldStart = await starter(project, opt);
    if (shouldStart) {
      if (
        !opt.lastChecked ||
        (opt.lastChecked && !done.includes(project.name))
      ) {
        tops.push(
          ...prioritize.filter((p) => p === project.name.toLowerCase())
        );
        const priority = tops && tops.indexOf(project.name) + 1;
        done.push(project.name);

        log.info(`Starting ${project.name} with status ${project.status}`);

        useRabbitMQ(
          "main",
          "send",
          JSON.stringify({
            event: "redeploy",
            data: { projectId: project._id, upKeep: true, priority },
          })
        );
        // sleep for max of 20secs
        await randomDelay(2000, 5000);
      }
    }
  }
  done.length = 0;
};

const processPreview = async (opt: IOpt = {}) => {
  const previews = await Preview.find();
  for (const preview of previews) {
    const shouldStart = await starter(preview, opt);
    if (shouldStart) {
      if (
        !opt.lastChecked ||
        (opt.lastChecked && !pr_done.includes(preview.name))
      ) {
        pr_done.push(preview.name);

        useRabbitMQ(
          "main",
          "send",
          JSON.stringify({
            event: "redeploy",
            data: { preview, upKeep: true },
          })
        );
        // sleep for max of 20secs
        await randomDelay(2000, 5000);
      }
    }
  }
  pr_done.length = 0;
};

export const keepInSync = async (opt?: IOpt) => {
  await Promise.all([processProject(opt), processPreview(opt)]);
};

const starter = async (
  data: IProject | IPreview,
  opt: { lastChecked?: boolean } = {}
) => {
  const { port, ip } = data;
  const { status, repo } = data as IProject;
  const { project } = data as IPreview;

  try {
    if (!ip || !port) throw new Error("Missing ip or port");

    const urlString = `http://${ip}:${port}`;

    await axios(urlString, { timeout: 60000 });
    return false;
  } catch (e) {
    const err = e as AxiosError;
    const error = err.toJSON() as AxiosError;

    if (!opt.lastChecked && error.status !== 404) return true;

    if (
      !project &&
      (status === "FAILED" ||
        !repo?.name ||
        error.message === "Missing ip or port" ||
        error.status === 404 ||
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT")
    ) {
      return false;
    } else {
      return true;
    }
  }
};
