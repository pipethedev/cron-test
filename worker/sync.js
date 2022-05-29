const fetch = require("node-fetch");
const { register } = require("redbird");
const { queue } = require("../config");

const syncDomain = queue("domain_sync");

syncDomain.process(async (job, done) => {
  const { domain, port, dir, outputDirectory } = job.data;
  if (!dir || !outputDirectory) {
    return done(new Error("Missing required data"));
  }
  const urlString = `http://127.0.0.1:${port}`;

  try {
    await fetch(urlString);

    register(domain, urlString);
  } catch (error) {
    require("child_process").execSync(
      `brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory}`
    );
    done(new Error(error.message));
  }
});

syncDomain.on("completed", (job, result) => {
  console.log(`${job.data.domain} is available`);
});

syncDomain.on("failed", (job, err) => {
  console.log(`${job.data.domain} is not available: REASON — ${err.message}`);
});

module.exports = {
  syncDomain,
};
