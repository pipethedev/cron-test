import { useRabbitMQ } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { rabbitMQ } from "./rabbitmq";
import { jobs } from "./jobs";

connectToMongo(process.env.MONGODB_URI || "");

useRabbitMQ("main", "send", JSON.stringify({ event: "Test", data: "Working" }));

jobs.uptime.start();
jobs.pending.start();

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

function closeApp() {
  console.log("Shutting down gracefully");

  jobs.uptime.stop();
  jobs.pending.stop();
  rabbitMQ.close();
  closeMongo();
  process.exit(0);
}
