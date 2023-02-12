import { IDomain, IProject, Log, PROJECT_STATUS } from "@brimble/models";
import axios from "axios";
import fs from "fs";
import { Project } from "@brimble/models";
import { spawn, exec } from "child_process";
import path from "path";
import { proxy, socket } from "../config";
import { container, delay } from "tsyringe";
import { KeepSyncQueue } from "../queue/keep-sync.queue";
import { Job } from "bullmq";
import { LeanDocument } from "mongoose";

const projectSync = container.resolve(delay(() => KeepSyncQueue));

export const keepInSync = async () => {
  const projects = await Project.find().lean().exec();
  const data = projects.map((project: LeanDocument<IProject>) => ({
    name: projectSync.queueName,
    data: { id: project._id },
  }));

  await projectSync.executeBulk(data);
};

export const keepInSyncWorker = async (job: Job) => {
  const { id } = job.data;

  try {
    if (!id || id === "undefined") return;

    const project = await Project.findById(id).populate(["domains", "log"]);

    if (!project) return;

    const {
      domains,
      port,
      dir,
      outputDirectory,
      buildCommand,
      name,
      rootDir,
      _id,
      log,
      pid: oldPid,
    } = project;

    const shouldStart = await starter({
      domains,
      port,
      dir,
      name,
      log,
      id: _id,
    });
    if (shouldStart) {
      let done = false,
        failed = false;

      console.log(`Redeploying ${name}...`);
      const deployLog = `${dir}/deploy.log`;
      const startTime = new Date().toISOString();

      const fileDir = rootDir ? path.join(dir, rootDir) : dir;
      const start = spawn(
        "nohup",
        [
          "brimble",
          "dev",
          `${fileDir}`,
          `${port ? `"-p ${port}"` : ""}`,
          "-so",
          buildCommand ? "--build-command" : "",
          buildCommand ? `"${buildCommand}"` : "",
          outputDirectory ? "--output-directory" : "",
          outputDirectory ? `"${outputDirectory}"` : "",
          ">>",
          deployLog,
          "2>&1",
          "&",
        ],
        { shell: true }
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
        const buff = data.toString();
        const messages = buff.split("\n");

        await Promise.all(
          messages?.map(async (message: string) => {
            message = message.trim().toLowerCase();
            if (message.includes("failed")) {
              const status = PROJECT_STATUS.FAILED;
              await Project.findByIdAndUpdate(_id, { status });
              log &&
                (await Log.findByIdAndUpdate(log._id, {
                  status,
                  startTime,
                  endTime: new Date().toISOString(),
                }));

              failed = true;
            }
          })
        );

        const pid = buff.match(/PID: \d+/g);
        const url = buff.match(/http:\/\/[a-zA-Z0-9-.]+:[0-9]+/g);
        if (url && pid) {
          let urlString = url[0];
          const port = urlString.match(/:[0-9]+/g);

          urlString = urlString.replace("localhost", "127.0.0.1");

          await Project.findByIdAndUpdate(project?._id, {
            pid: pid?.[0].split(":")[1].trim(),
            port: port?.[0].split(":")[1].trim(),
            status: PROJECT_STATUS.ACTIVE,
          });
          log &&
            (await Log.findByIdAndUpdate(log._id, {
              status: PROJECT_STATUS.ACTIVE,
              startTime,
              endTime: new Date().toISOString(),
            }));

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

      while (!done && !failed)
        await new Promise((resolve) => setTimeout(resolve, 1000));

      await new Promise((resolve) =>
        setTimeout(() => {
          exec(`kill -9 ${watcher.pid}`);
          exec(`kill -9 ${start.pid}`);
          if (done) {
            console.log(`${name} redeployed 🚀`);
            exec(`kill -9 ${oldPid}`);
            exec(`pkill -f jest-worker/processChild.js`);
          }
          resolve(true);
        }, 10000)
      );

      if (done) console.log(`Project ${project.name} deployed successfully`);
      else if (failed) console.log(`${project.name} deploy failed`);
    }
  } catch (error: any) {
    console.error(`${name} couldn't start | ${error.message}`);
    throw new Error(`${name} couldn't start | ${error.message}`);
  }
};

const starter = async (data: any) => {
  const { domains, port, dir, name, log, id } = data;

  if (!name) return false;

  const urlString = `http://127.0.0.1:${port}`;

  if (!dir) {
    console.error(`${name} is not properly configured`);
    return false;
  } else if (!fs.existsSync(dir)) {
    console.error(`${dir} does not exist -> ${name}`);
    await Project.findByIdAndDelete(id);
    return false;
  } else {
    try {
      await axios(urlString);

      if (log && log.status === PROJECT_STATUS.PENDING) return true;

      domains.forEach((domain: IDomain) => {
        proxy.register(domain.name, urlString, { isWatchMode: true });
      });
      return false;
    } catch (error) {
      const { message } = error as Error;
      console.error(`${name} is not running reason: ${message}`);
      return true;
    }
  }
};
