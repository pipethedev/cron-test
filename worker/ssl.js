const { spawn } = require("child_process");
const { queue } = require("../config");

const sslWorker = queue("ssl");

sslWorker.process(async (job) => {
  const { domain } = job.data;
  const child = spawn("certbot", [
    "certonly",
    "--nginx",
    "-w",
    "/var/www/letsencrypt",
    "-d",
    domain,
    "--agree-tos",
    "--non-interactive",
    "--text",
    "--no-eff-email",
    "--force-renewal",
  ]);

  child.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  child.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(`SSL certificate for ${domain} has been renewed`);
    } else {
      console.error(`SSL certificate for ${domain} has not been renewed`);
    }
  });

  return Promise.resolve();
});

sslWorker.on("completed", (job) => {
  console.log(`SSL certificate for ${job.data.domain} has been renewed`);
});

module.exports = {
  sslWorker,
};
