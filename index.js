const { pusherClient, proxy } = require("./config");
const { connectToMongo } = require("./db");
const { sslWorker } = require("./worker/ssl");

const channel = pusherClient.subscribe("domain");

connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();

channel.bind("register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, id);
});

channel.bind("unregister", ({ domain }) => {
  proxy.unregister(domain);
});

channel.bind("ssl", ({ domain }) => {
  sslWorker.add({ domain });
});
