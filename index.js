const { pusherClient, proxy } = require("./config");
const { connectToMongo } = require("./db");
const { syncDomain } = require("./worker/sync");

const channel = pusherClient.subscribe("domain");

connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();
syncDomain.add({
  domain: process.env.DOMAIN || "brimble.test",
  port: process.env.PORT || 5000,
});

channel.bind("register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, id);
});

channel.bind("unregister", ({ domain }) => {
  proxy.unregister(domain);
});

channel.bind("ssl", ({ domain, id }) => {
  sslWorker.add({ domain, id });
});
