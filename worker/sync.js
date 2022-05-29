const fetch = require("node-fetch");
const { queue, proxy } = require("../config");
const { Project } = require("../db/models");

const projectSync = queue("project_sync");

projectSync.process(async (job, done) => {
  const projects = await Project.find({}).populate("domains");

  projects.forEach(({ domains, port, dir, outputDirectory }) => {
    domains.forEach(async (domain) => {
      const urlString = `http://127.0.0.1:${port}`;

      if (!dir || !outputDirectory) {
        return done(new Error(`${domain.name} is not properly configured`));
      }

      try {
        await fetch(urlString);

        proxy.register(domain, urlString, { isWatchMode: true });

        done(null, `${domain.name} is properly configured`);
      } catch (error) {
        require("child_process").execSync(
          `brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory}`
        );
        done(new Error(error.message));
      }
    });
  });
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
