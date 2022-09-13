const { proxy, socket } = require("./config");
const { connectToMongo } = require("@brimble/models");
const { keepInSync } = require("./worker");

connectToMongo(process.env.MONGODB_URI || "");

keepInSync({ project: { interval: "*/1 * * * *" } });

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.PORT || 5000}`,
  {}
);

socket.on("domain-register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, { id });
});

socket.on("domain-unregister", ({ domain }) => {
  proxy.unregister(domain);
});
