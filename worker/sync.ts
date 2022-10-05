import { IDomain, IProject } from "@brimble/models";
import axios from "axios";
import fs from "fs";
import { Project } from "@brimble/models";
import { spawn } from "child_process";
import path from "path";
import { proxy, socket } from "../config";
import { container, delay } from "tsyringe";
import { KeepSyncQueue } from "../queue/keep-sync.queue";
import { Job } from "bullmq";

const projectSync = container.resolve(delay(() => KeepSyncQueue));

export const keepInSync = async ({ project }: any) => {
  if (project) {
    const { interval } = project;
    setInterval(async () => {
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
    }, interval);
  }
};

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
            watcher.kill();
          }
        });

        const pid = log.match(/PID: \d+/g);
        const url = log.match(/http:\/\/[a-zA-Z0-9-.]+:[0-9]+/g);
        if (url && pid) {
          let urlString = url[0];
          const port = urlString.match(/:[0-9]+/g);

          urlString = urlString.replace("localhost", "127.0.0.1");

          const proj = await Project.findById(project?._id).populate("domains");
          if (proj) {
            proj.pid = pid?.[0].split(":")[1].trim();
            proj.port = port?.[0].split(":")[1].trim();
            await proj.save();
            domains.forEach((domain: IDomain) => {
              proxy.register(domain.name, urlString, {
                isWatchMode: true,
              });
              socket.emit("domain:clear_cache", {
                domain: domain.name,
              });
            });

            spawn("kill", [`${project.pid}`]);
            spawn("kill", ["-9", `lsof -t -i:${project.port}`]);
          }

          console.log(`${project?.name} redeployed`);
          watcher.kill();
        }
      });
    }
  } catch (error: any) {
    console.log(`${name} couldn't start | ${error.message}`);
  }
};

const starter = async (data: any) => {
  const { domains, port, dir, name } = data;

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
      const { response } = error as any;
      return response && response.status === 404;
    }
  }
};
