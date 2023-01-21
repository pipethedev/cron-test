import { IDomain, IProject, PROJECT_STATUS } from "@brimble/models";
import axios from "axios";
import fs from "fs";
import { Project } from "@brimble/models";
import { spawn, exec } from "child_process";
import path from "path";
import { proxy, socket } from "../config";
import { container, delay } from "tsyringe";
import { KeepSyncQueue } from "../queue/keep-sync.queue";
import { Job } from "bullmq";

const projectSync = container.resolve(delay(() => KeepSyncQueue));

export const keepInSync = async () => {
  const projects = await Project.find().populate("domains");
  const data = projects.map((project: IProject) => ({
    name: "project_sync",
    data: { project },
    opts: {
      priority: projects.indexOf(project) + 1,
      delay: projects.indexOf(project) * 1000,
    },
  }));

  await projectSync.executeBulk(data);
};

export const keepInSyncWorker = async (job: Job) => {
  const { project } = job.data;
  const { domains, port, dir, outputDirectory, buildCommand, name, rootDir } =
    project;

  try {
    if (!project || !name || name === "undefined") return;
    const shouldStart = await starter({ domains, port, dir, name });
    if (shouldStart) {
      let done = false,
        failed = false;

      console.log(`Redeploying ${name}...`);
      const deployLog = `${dir}/deploy.log`;

      const fileDir = rootDir ? path.join(dir, rootDir) : dir;
      const start = spawn(
        "nohup",
        [
          "brimble",
          "dev",
          `${fileDir}`,
          `${port && `"-p ${port}"`}`,
          "-so",
          buildCommand && "--build-command",
          buildCommand && `"${buildCommand}"`,
          outputDirectory && "--output-directory",
          outputDirectory && `"${outputDirectory}"`,
          ">>",
          deployLog,
          "2>&1&",
        ],
        {
          shell: true,
        }
      );

      start.stderr.on("data", (data) => {
        const message = data.toString();
        fs.createWriteStream(deployLog, message);
      });

      start.on("close", (code) => {
        if (code !== 0) {
          fs.createWriteStream(
            deployLog,
            `child process exited with code ${code as any}`
          );
        }
      });

      const watcher = spawn("tail", ["-f", deployLog]);
      watcher.stdout.on("data", async (data: any) => {
        const log = data.toString();
        const logs = log.split("\n");

        await Promise.all(
          logs?.map(async (message: string) => {
            message = message.trim().toLowerCase();
            if (message.includes("failed")) {
              await Project.findByIdAndUpdate(project?._id, {
                status: PROJECT_STATUS.FAILED,
              });
              failed = true;
            }
          })
        );

        const pid = log.match(/PID: \d+/g);
        const url = log.match(/http:\/\/[a-zA-Z0-9-.]+:[0-9]+/g);
        if (url && pid) {
          let urlString = url[0];
          const port = urlString.match(/:[0-9]+/g);

          urlString = urlString.replace("localhost", "127.0.0.1");

          await Project.findByIdAndUpdate(project?._id, {
            pid: pid?.[0].split(":")[1].trim(),
            port: port?.[0].split(":")[1].trim(),
            status: PROJECT_STATUS.ACTIVE,
          });
          domains.forEach((domain: IDomain) => {
            proxy.register(domain.name, urlString, {
              isWatchMode: true,
            });
            socket.emit("domain:clear_cache", {
              domain: domain.name,
            });
          });
          done = true;
        }
      });

      while (!done && !failed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setTimeout(() => {
        exec(`kill -9 ${watcher.pid}`);
        exec(`kill -9 ${start.pid}`);
        watcher.kill();
        start.kill();
      }, 5000);

      if (done) {
        console.log(`${name} redeployed 🚀`);
        exec(`kill -9 ${project.pid}`);
        return `${name} started successfully`;
      } else if (failed) {
        console.error(`Redeployment failed | ${name}`);
        throw new Error(`${name} couldn't start`);
      }
    }
  } catch (error: any) {
    console.error(`${name} couldn't start | ${error.message}`);
    throw new Error(`${name} couldn't start | ${error.message}`);
  }
};

const starter = async (data: any) => {
  const { domains, port, dir, name } = data;

  if (!name) return false;

  const urlString = `http://127.0.0.1:${port}`;

  if (!dir) {
    console.error(`${name} is not properly configured`);
    return false;
  } else if (!fs.existsSync(dir)) {
    console.error(`${dir} does not exist -> ${name}`);
    return false;
  } else {
    try {
      await axios(urlString);

      domains.forEach((domain: IDomain) => {
        proxy.register(domain.name, urlString, { isWatchMode: true });
      });
      return false;
    } catch (error) {
      const { code } = error as any;
      console.error(`${name} is not running on ${port} -> ${code}`);
      return true;
    }
  }
};
