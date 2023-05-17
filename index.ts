import "reflect-metadata";
import restana from "restana";
import { proxy, socket, useRabbitMQ } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { RedisClient } from "./redis/redis-client";
import { keepInSync, projectSync } from "./worker/sync";
import { rabbitMQ } from "./rabbitmq";

connectToMongo(process.env.MONGODB_URI || "");

const service = restana({});
const redisClient = container.resolve(delay(() => RedisClient));

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
proxy.register(
  `${process.env.DOMAIN}/auth` || "brimble.test/auth",
  `http://127.0.0.1:${process.env.AUTH_PORT || 8000}`,
  {}
);

keepInSync();
useRabbitMQ("proxy", "consume");
useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

service.get("/", (_, res) => {
  return res.send({ status: 200, message: "Proxy server running" });
});

service.post("/", (req, res) => {
  const apiKey = req.headers["brimble-proxy-key"];
  if (apiKey === process.env.PROXY_AUTH_KEY) {
    console.log("Running proxy triggered by AWS");
    keepInSync({ checkLast: true });
    return res.send({ status: 200, message: "Proxy triggered" });
  }
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
  projectSync.closeWorker();
  process.exit(0);
}
