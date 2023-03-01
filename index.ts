import "reflect-metadata";
import restana from "restana";
import { proxy, socket, useRabbitMQ } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { RedisClient } from "./redis/redis-client";
import { keepInSync } from "./worker/sync";
import useScheduler from "./queue/scheduler";
import { rabbitMQ } from "./rabbitmq";
import { QueueClass } from "./queue";

connectToMongo(process.env.MONGODB_URI || "");

const service = restana({});
const redisClient = container.resolve(delay(() => RedisClient));
const queue = container.resolve(delay(() => QueueClass));

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.API_PORT || 5000}`,
  {}
);
proxy.register(
  `${process.env.DOMAIN}/proxy` || "brimble.test/proxy",
  `http://127.0.0.1:${process.env.PORT || 3000}`,
  {}
);

keepInSync();
useScheduler();
useRabbitMQ("main", "consume");
useRabbitMQ(
  "proxy",
  "send",
  JSON.stringify({ event: "Test", data: "Working" })
);

service.get("/", (_, res) => {
  return res.send({
    status: 200,
    message: "Proxy server running",
  });
});

service.post("/stop", (_, res) => {
  useScheduler().stop();
  return res.send({
    status: 200,
    message: "Scheduler stopped",
  });
});

socket.on("end", function () {
  socket.disconnect();
  socket.close();
});

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

service.start(Number(process.env.PORT) || 3000);

function closeApp() {
  console.log("Shutting down gracefully");
  socket.disconnect();
  socket.close();
  redisClient.close();
  rabbitMQ.close();
  closeMongo();
  service.close();
  queue.closeWorker();
  process.exit(0);
}
