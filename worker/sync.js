const fetch = require("node-fetch");
const fs = require("fs");
const { queue, proxy } = require("../config");
const { Project } = require("../db/models");

const projectSync = queue("project_sync");

projectSync.process(async (job, done) => {
  const projects = await Project.find({}).populate("domains");
  const errors = [];
  const success = [];

  projects.forEach(({ domains, port, dir, outputDirectory }) => {
    domains.forEach(async ({ name }) => {
      const urlString = `http://127.0.0.1:${port}`;

      if (!dir || !outputDirectory) {
        errors.push(`${name} is not properly configured`);
      } else if (!fs.existsSync(dir)) {
        errors.push(`${dir} does not exist`);
      } else {
        try {
          await fetch(urlString);

          proxy.register(name, urlString, { isWatchMode: true });

          success.push(`${name} is properly configured`);
        } catch (error) {
          try {
            require("child_process").exec(
              `brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory}`
            );
            success.push(`${name} has been properly configured`);
          } catch (error) {
            errors.push(`${name} couldn't start | ${error.message}`);
          }
        }
      }
    });
  });

  if (errors.length) {
    done(new Error(errors.join("\n")));
  }

  if (success.length) {
    done(null, success.join("\n"));
  }
});

projectSync.on("completed", (job, result) => {
  console.log(`${job.id} completed with result: ${result}`);
});

projectSync.on("failed", (job, err) => {
  console.log(`${err.message}`);
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
