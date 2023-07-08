import "reflect-metadata";
import { useRabbitMQ } from "./config";
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

keepInSync();
useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));
app.set("view engine", "hbs");
app.use("/", router);

app.listen(process.env.PORT || 3030);

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

function closeApp() {
  console.log("Shutting down gracefully");

  redisClient.close();
  rabbitMQ.close();
  closeMongo();
  projectSync.closeWorker();
  process.exit(0);
}
