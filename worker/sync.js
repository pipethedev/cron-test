const { queue, proxy } = require("../config");

const syncDomain = queue("domain_sync");

syncDomain.process(async (job, done) => {
  const { domain, port } = job.data;

  proxy(domain, `http://127.0.0.1:${port}`);

  done(null, {
    status: "success",
    message: `${domain} synced`,
  });
});

module.exports = {
  syncDomain,
};
