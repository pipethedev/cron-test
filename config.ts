import { io } from "socket.io-client";
import dotenv from "dotenv";
import { Queue } from "bullmq";
import { RedisClient } from "./redis/redis-client";
import { container, delay } from "tsyringe";
require("dotenv").config();

const redbird = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  bunyan: false,
});

dotenv.config();

const redis = container.resolve(delay(() => RedisClient));

export const socket = io(`http://127.0.0.1:${process.env.API_PORT || 5000}`);

export const queue = (name: string) =>
  new Queue(name, {
    connection: redis.get().duplicate(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

export const proxy = {
  // create a register function to register the domain with the proxy
  async register(domain: string, ip: string, { id, isWatchMode }: any) {
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
  unregister(domain: string) {
    redbird.unregister(domain);
  },

  changeDefault() {
    redbird.notFound((req: any, res: any) => {
      // TODO: Create Brimble 404 page
      const host = req.headers.host;
      const requestId = req.headers["x-brimble-id"];
      res.statusCode = 404;
      res.end(`Deployment not found for ${host}`);
    });
  },
};
