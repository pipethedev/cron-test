import { IDomain, IProject } from "@brimble/models";
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
  const projects = await Project.find({}).populate("domains");
  await Promise.all(
    projects.map(async (project: IProject) => {
      const {
        domains,
        port,
        dir,
        outputDirectory,
        buildCommand,
        name,
        rootDir,
      } = project;

      const start = await starter({ domains, port, dir, name });
      if (start) {
        await projectSync.execute({
          domains,
          port,
          dir,
          outputDirectory,
          buildCommand,
          name,
          rootDir,
          project,
        });
      }
    })
  );
};

setInterval(async () => {
  await keepInSync();
}, Number(process.env.SYNC_INTERVAL || 300000));

export const keepInSyncWorker = async (job: Job) => {
  const {
    domains,
    port,
    dir,
    outputDirectory,
    buildCommand,
    name,
    rootDir,
    project,
  } = job.data;
  try {
    const start = await starter({ domains, port, dir, name });
    if (start) {
      const deployLog = `${dir}/deploy.log`;

      const fileDir = rootDir ? path.join(dir, rootDir) : dir;
      spawn(
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
          ">",
          deployLog,
          "&",
        ],
        {
          shell: true,
        }
      );

      const watcher = spawn("tail", ["-f", deployLog]);
      watcher.stdout.on("data", async (data: any) => {
        const log = data.toString();

        log.split("\n").forEach((line: any) => {
          const lowerCaseLine = line.toLowerCase();
          if (lowerCaseLine.includes("failed")) {
            exec(`kill -9 ${watcher.pid}`);
          }
        });

        const pid = log.match(/PID: \d+/g);
        const url = log.match(/http:\/\/[a-zA-Z0-9-.]+:[0-9]+/g);
        if (url && pid) {
          let urlString = url[0];
          const port = urlString.match(/:[0-9]+/g);

          urlString = urlString.replace("localhost", "127.0.0.1");

          await Project.findByIdAndUpdate(project?._id, {
            pid: pid?.[0].split(":")[1].trim(),
            port: port?.[0].split(":")[1].trim(),
          });
          domains.forEach((domain: IDomain) => {
            proxy.register(domain.name, urlString, {
              isWatchMode: true,
            });
            socket.emit("domain:clear_cache", {
              domain: domain.name,
            });
          });

          const oldPid = project.pid;
          console.log(`${project?.name} redeployed`);

          setTimeout(() => {
            exec(`kill -9 ${watcher.pid}`);
            exec(`kill -9 ${oldPid}`);
            watcher.kill();
          }, 5000);
        }
      });
    }
  } catch (error: any) {
    console.log(`${name} couldn't start | ${error.message}`);
  }
};

const starter = async (data: any) => {
  const { domains, port, dir, name } = data;

  if (!name) return false;

  const urlString = `http://127.0.0.1:${port}`;

  if (!dir) {
    console.log(`${name} is not properly configured`);
    return false;
  } else if (!fs.existsSync(dir)) {
    console.log(`${dir} does not exist`);
    return false;
  } else {
    try {
      await axios(urlString);

      domains.forEach((domain: IDomain) => {
        proxy.register(domain.name, urlString, { isWatchMode: true });
      });

      console.log(`${name} is properly configured`);
      return false;
    } catch (error) {
      return true;
    }
  }
};
