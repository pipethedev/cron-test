const { pusherClient, proxy } = require("./config");
const { connectToMongo } = require("./db");
const { keepInSync } = require("./worker");

const channel = pusherClient.subscribe("domain");

connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();
keepInSync({
  domain: process.env.DOMAIN || "brimble.test",
  port: process.env.PORT || 5000,
  isMain: true,
});

channel.bind("register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, { id });
});

channel.bind("unregister", ({ domain }) => {
  proxy.unregister(domain);
});
