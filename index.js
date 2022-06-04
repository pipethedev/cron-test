const { proxy, redisClient } = require("./config");
const { connectToMongo } = require("./db");

connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.PORT || 5000}`,
  {}
);

(async () => {
  const { subscriber } = await redisClient();
  subscriber.subscribe("domain-register", (data) => {
    const { domain, ip, id } = JSON.parse(data);
    proxy.unregister(domain);
    proxy.register(domain, ip, { id });

    subscriber.quit();
  });

  subscriber.subscribe("domain-unregister", (data) => {
    const { domain } = JSON.parse(data);
    proxy.unregister(domain);

    subscriber.quit();
  });
})();
