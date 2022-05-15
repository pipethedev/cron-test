const { queue, proxy } = require("../config");
const { connectToMongo } = require("../db");

const syncDomain = queue("domain_sync");

syncDomain.process(async (job, done) => {
  const { domain, port } = job.data;

  proxy(domain, `http://127.0.0.1:${port}`);
});

module.exports = {
  syncDomain,
};
