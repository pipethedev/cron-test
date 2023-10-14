import "reflect-metadata";

import { useRabbitMQ } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { RedisClient } from "./redis/redis-client";
import { rabbitMQ } from "./rabbitmq";
import { pendingCron } from "./worker/sync";

const redisClient = container.resolve(delay(() => RedisClient));
connectToMongo(process.env.MONGODB_URI || "");

useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

pendingCron.start();

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

function closeApp() {
  console.log("Shutting down gracefully");

  pendingCron.stop();
  redisClient.close();
  rabbitMQ.close();
  closeMongo();
  process.exit(0);
}
