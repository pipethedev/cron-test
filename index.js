const { pusherClient, proxy } = require("./config");
const { connectToMongo } = require("./db");

const channel = pusherClient.subscribe("domain");

connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.PORT || 5000}`,
  {}
);

channel.bind("register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, { id });
});

channel.bind("unregister", ({ domain }) => {
  proxy.unregister(domain);
});
