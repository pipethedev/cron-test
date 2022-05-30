const fetch = require("node-fetch");
const fs = require("fs");
const { queue, proxy } = require("../config");
const { Project } = require("../db/models");

const projectSync = queue("project_sync");

projectSync.process(async () => {
  const projects = await Project.find({}).populate("domains");

  projects.forEach(({ domains, port, dir, outputDirectory }) => {
    domains.forEach(async ({ name }) => {
      const urlString = `http://127.0.0.1:${port}`;

      if (!dir || !outputDirectory) {
        console.log(`${name} is not properly configured`);
      } else if (!fs.existsSync(dir)) {
        console.log(`${dir} does not exist`);
      } else {
        try {
          await fetch(urlString);

          proxy.register(name, urlString, { isWatchMode: true });

          console.log(`${name} is properly configured`);
        } catch (error) {
          try {
            require("child_process").exec(
              `brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory}`
            );
            console.log(`${name} has been properly configured`);
          } catch (error) {
            console.log(`${name} couldn't start | ${error.message}`);
          }
        }
      }
    });
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
