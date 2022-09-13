const axios = require("axios");
const fs = require("fs");
const { queue, proxy } = require("../config");
const { Project } = require("@brimble/models");

const projectSync = queue("project_sync");

projectSync.process(async (job, done) => {
  const projects = await Project.find({}).populate("domains");

  await Promise.all(
    projects.map(async (project) => {
      const { domains, port, dir, outputDirectory, buildCommand, name } =
        project;

      const urlString = `http://127.0.0.1:${port}`;

      if (!dir || !outputDirectory) {
        console.log(`${name} is not properly configured`);
      } else if (!fs.existsSync(dir)) {
        console.log(`${dir} does not exist`);
      } else {
        try {
          await axios(urlString);

          domains.forEach((domain) => {
            proxy.register(domain.name, urlString, { isWatchMode: true });
          });

          console.log(`${name} is properly configured`);
        } catch (error) {
          try {
            const deployLog = `${project.dir}/deploy.log`;
            require("child_process").exec(
              `nohup brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory} --build-command "${buildCommand}" > ${deployLog} 2>&1 &`
            );

            const watcher = spawn("tail", ["-f", deployLog]);
            watcher.stdout.on("data", async (data) => {
              const log = data.toString();

              log.split("\n").forEach((line) => {
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

                if (project) {
                  const oldPort = project.port,
                    oldPid = project.pid;
                  project.pid = pid?.[0].split(":")[1].trim();
                  project.port = port?.[0].split(":")[1].trim();
                  await project.save();
                  domains.forEach((domain) => {
                    proxy.register(domain.name, urlString, {
                      isWatchMode: true,
                    });
                    io.timeout(30000).emit(
                      "domain:clear_cache",
                      { domain: domain.name },
                      (err) => {
                        if (err) console.error(err);
                      }
                    );
                  });

                  spawn("kill", [`${oldPid}`]);
                  spawn("kill", ["-9", `lsof -t -i:${oldPort}`]);
                }

                console.log(`${project?.name} redeployed`);
                watcher.kill();
              }
            });
          } catch (error) {
            console.log(`${name} couldn't start | ${error.message}`);
          }
        }
      }
    })
  );

  done();
});

const keepInSync = async ({ project }) => {
  projectSync.add({});
  if (project) {
    const { interval } = project;
    projectSync.add({}, { repeat: { cron: interval || "*/1 * * * *" } });
  }
};
module.exports = {
  keepInSync,
};
