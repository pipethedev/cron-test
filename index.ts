import "reflect-metadata";
import { DOMAIN, PORT, proxy, socket, useRabbitMQ } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { RedisClient } from "./redis/redis-client";
import { keepInSync, projectSync } from "./worker/sync";
import { rabbitMQ } from "./rabbitmq";
import path from "path";
import express, { Application } from "express";
import router from "./route";
import cookieParser from "cookie-parser";

const app: Application = express();
const redisClient = container.resolve(delay(() => RedisClient));
connectToMongo(process.env.MONGODB_URI || "");

proxy.changeDefault();
proxy.register(DOMAIN.app, `http://127.0.0.1:${PORT.api}`);
proxy.register(DOMAIN.auth, `http://127.0.0.1:${PORT.auth}`);
proxy.register(DOMAIN.proxy, `http://127.0.0.1:${PORT.app}/proxy`);

keepInSync();
useRabbitMQ("proxy", "consume");
useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/", router);

app.listen(PORT.app);

socket.on("end", () => {
  socket.disconnect();
  socket.close();
});

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

function closeApp() {
  console.log("Shutting down gracefully");
  socket.disconnect();
  socket.close();
  redisClient.close();
  rabbitMQ.close();
  closeMongo();
  projectSync.closeWorker();
  process.exit(0);
}
