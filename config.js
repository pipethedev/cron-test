const { io } = require("socket.io-client");
const dotenv = require("dotenv");
const Queue = require("bull");
require("dotenv").config();

const redbird = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  silent: true,
});

dotenv.config();

const socket = io(`http://127.0.0.1:${process.env.PORT || 5000}`);

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
  async register(domain, ip, { id, isWatchMode }) {
    try {
      redbird.register(domain, ip);
      if (!isWatchMode) {
        if (id) {
          socket.emit(`${id}-domain_mapped`, {
            message: "Domain mapped successfully",
            domain: `${
              process.env.NODE_ENV !== "production" ? "http" : "https"
            }://${domain}`,
          });
        } else {
          socket.emit("domain-success", {
            message: "Proxy server started",
            domain: `${
              process.env.NODE_ENV !== "production" ? "http" : "https"
            }://${domain}`,
          });
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
  socket,
};
