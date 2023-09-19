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
import * as Sentry from "@sentry/node";

const app: Application = express();
const redisClient = container.resolve(delay(() => RedisClient));
connectToMongo(process.env.MONGODB_URI || "");

keepInSync();
useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/", router);
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(Sentry.Handlers.errorHandler());

errorTracking(app);

app.listen(process.env.PORT || 3333);

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

function errorTracking(app: Application) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
    tracesSampleRate: 1.0,
  });
}
