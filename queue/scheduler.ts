import { Worker } from "bullmq";
import { queue } from "../config";
import { keepInSync } from "../worker/sync";

const scheduleQueue = queue("scheduler");

new Worker("scheduler", async (job) => keepInSync());

const schedule = async () => {
  await scheduleQueue.add("scheduler", {}, { repeat: { pattern: "*/5 * * * *" } });

  console.log("Scheduler started");
};

export default schedule;
