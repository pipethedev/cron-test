const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { queue, proxy } = require("../config");
const { Project } = require("../db/models");

const projectSync = queue("project_sync");

projectSync.process(async () => {
  const projects = await Project.find({}).populate("domains");

  projects.forEach(async (project) => {
    const { domains, port, dir, outputDirectory, uuid } = project;
    const domain = domains.map(async ({ name }) => {
      const urlString = `http://127.0.0.1:${port}`;

      if (!dir || !outputDirectory) {
        console.log(`${name} is not properly configured`);
      } else if (!fs.existsSync(dir)) {
        console.log(`${dir} does not exist`);
      } else {
        try {
          await axios(urlString);

          proxy.register(name, urlString, { isWatchMode: true });

          console.log(`${name} is properly configured`);
        } catch (error) {
          try {
            const uptimeLog = path.join(
              process.env.PROJECT_PATH || "",
              `projects/${uuid}/uptime.log`
            );
            const start = require("child_process").exec(
              `nohup brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory} > ${uptimeLog} 2>&1 &`
            );

            start.on("exit", async () => {
              project.pid = start.pid;
              console.log(`${name} is now running`);
              return await project.save();
            });
          } catch (error) {
            console.log(`${name} couldn't start | ${error.message}`);
          }
        }
      }
    });

    await Promise.all(domain);
  });
});

const keepInSync = async ({ project }) => {
  if (project) {
    const { interval } = project;
    projectSync.add({}, { repeat: { cron: interval || "*/1 * * * *" } });
  }
};
module.exports = {
  keepInSync,
};
