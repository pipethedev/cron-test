const Pusher = require("pusher");
const PusherJs = require("pusher-js");
const dotenv = require("dotenv");
const Queue = require("bull");
require("dotenv").config();

const redbird = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  silent: true,
});

dotenv.config();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_APP_KEY || "",
  secret: process.env.PUSHER_APP_SECRET || "",
  cluster: process.env.PUSHER_APP_CLUSTER || "eu",
});

const pusherClient = new PusherJs(process.env.PUSHER_APP_KEY || "", {
  cluster: "eu",
});

const queue = (background_name) =>
  new Queue(background_name, {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || "",
    },
  });

const proxy = {
  // create a register function to register the domain with the proxy
  register(domain, ip, { id, isWatchMode }) {
    try {
      redbird.register(domain, ip);

      if (!isWatchMode) {
        if (id) {
          pusher
            .trigger(`private-${id}`, "domain_mapped", {
              message: "Domain mapped successfully",
              domain: `${
                process.env.NODE_ENV !== "production" ? "http" : "https"
              }://${domain}`,
            })
            .catch((error) => {
              console.log(error);
            });
        } else {
          setTimeout(() => {
            pusher
              .trigger("domain", "success", {
                message: "Proxy server started",
                domain: `${
                  process.env.NODE_ENV !== "production" ? "http" : "https"
                }://${domain}`,
              })
              .catch((error) => {
                console.log(error);
              });
          }, 2000);
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
  pusher,
  pusherClient,
  queue,
  proxy,
};
