import { io } from "socket.io-client";
import dotenv from "dotenv";
import { Queue } from "bullmq";
import { RedisClient } from "./redis/redis-client";
import { container, delay } from "tsyringe";
import amqp from "amqplib";
require("dotenv").config();

const redbird = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  bunyan: false,
});

dotenv.config();

const redis = container.resolve(delay(() => RedisClient));
const API_URL =
  process.env.DOMAIN || `http://127.0.0.1:${process.env.API_PORT || 5000}`;
export const socket = io(API_URL);
socket.on("connect", () => {
  socket.emit("identify", { app: "proxy" });
});

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
            domain,
          });
        } else {
          socket.emit("domain-success", {
            message: "Proxy server started",
            domain,
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

export const useRabbitMQ = async () => {
  const connection = await amqp.connect(process.env.RABBITMQ_URI || "amqp://localhost");
  const channel = await connection.createChannel();

  await channel.assertQueue("proxy", { durable: true });

  channel.consume("proxy", (msg) => {
    if (msg) {
      const { event, data } = JSON.parse(msg.content.toString());
      if (event === "domain-register") {
        proxy.unregister(data.domain);
        proxy.register(data.domain, data.ip, { id: data.id });
      } else if (event === "domain-unregister") {
        proxy.unregister(data.domain);
      }
      channel.ack(msg);
    }
  });
};
