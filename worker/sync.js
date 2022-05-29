const fetch = require("node-fetch");
const { queue, proxy } = require("../config");

const syncDomain = queue("domain_sync");

syncDomain.process(async (job, done) => {
  const { domain, port, dir, outputDirectory, isMain } = job.data;
  const urlString = `http://127.0.0.1:${port}`;

  if (isMain) {
    proxy.register(domain, urlString, {});
    done();
  } else {
    if (!dir || !outputDirectory) {
      return done(new Error("Missing required data"));
    }

    try {
      await fetch(urlString);

      proxy.register(domain, urlString, { isWatchMode: true });
    } catch (error) {
      require("child_process").execSync(
        `brimble dev ${dir} -so -p ${port} --output-directory ${outputDirectory}`
      );
      done(new Error(error.message));
    }
  }
});

syncDomain.on("completed", (job, result) => {
  console.log(`${job.data.domain} is available`);
});

syncDomain.on("failed", (job, err) => {
  console.log(`${job.data.domain} is not available: REASON — ${err.message}`);
});

const keepInSync = async ({ domain, port, dir, outputDirectory, isMain }) => {
  syncDomain.add(
    { domain, port, dir, outputDirectory, isMain },
    !isMain ? { repeat: { cron: "*/5 * * * *" } } : {}
  );
};
module.exports = {
  keepInSync,
};
