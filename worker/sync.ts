import axios from "axios";
import { Project, Domain, PROJECT_STATUS } from "@brimble/models";
import { prioritize, randomDelay, useRabbitMQ } from "../config";

const done: string[] = [];

export const keepInSync = async (opt: { lastChecked?: boolean } = {}) => {
  const projects = await Project.find()
    .populate({ path: "server", select: "name" })
    .select([
      "port",
      "name",
      "status",
      "ip",
      "server",
      "passwordEnabled",
      "domains",
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
  console.log({ done });
  done.length = 0;
};

const starter = async (data: any, opt: { lastChecked?: boolean } = {}) => {
  const { _id, port, name, status, ip, server } = data;

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
              uri: !data.passwordEnabled && `${ip}:${port}`,
              host: server.name,
            },
          })
        );
      });
      data.domains = domains;

      await Project.updateOne(
        { _id },
        { domains: data.domains },
        { timestamps: false }
      );
    }

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
