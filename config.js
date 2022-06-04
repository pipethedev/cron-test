const dotenv = require("dotenv");
const { createClient } = require("redis");
const Queue = require("bull");
require("dotenv").config();

const redbird = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  silent: true,
});

dotenv.config();

const queue = (background_name) =>
  new Queue(background_name, {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || "",
    },
  });

const redisClient = () => {
  const subscriber = createClient({
    url: process.env.REDIS_URL || "",
  });

  const publisher = subscriber.duplicate();

  return { subscriber, publisher };
};

const proxy = {
  // create a register function to register the domain with the proxy
  async register(domain, ip, { id, isWatchMode }) {
    try {
      redbird.register(domain, ip);
      const { publisher } = redisClient();

      if (!isWatchMode) {
        if (id) {
          await publisher.connect();
          publisher
            .publish(
              `private-${id}-domain_mapped`,
              JSON.stringify({
                message: "Domain mapped successfully",
                domain: `${
                  process.env.NODE_ENV !== "production" ? "http" : "https"
                }://${domain}`,
              })
            )
            .catch((error) => {
              console.log(error.message);
            });
          publisher.quit();
        } else {
          await publisher.connect();
          publisher
            .publish(
              "domain-success",
              JSON.stringify({
                message: "Proxy server started",
                domain: `${
                  process.env.NODE_ENV !== "production" ? "http" : "https"
                }://${domain}`,
              })
            )
            .catch((error) => {
              console.log(error.message);
            });
          publisher.quit();
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  // create an unregister function to unregister the domain with the proxy
  unregister(domain) {
    redbird.unregister(domain);
  },

  changeDefault() {
    redbird.notFound((req, res) => {
      // TODO: Create Brimble 404 page
      const host = req.headers.host;
      const requestId = req.headers["x-brimble-id"];
      res.statusCode = 404;
      res.end(`Deployment not found for ${host}`);
    });
  },
};

module.exports = {
  queue,
  proxy,
  redisClient,
};
