import { PROJECT_STATUS, Log } from "@brimble/models";
import cron from "node-cron";
import { useRabbitMQ } from "../config";

const processPendingLogs = async () => {
  const logs = await Log.find({
    status: PROJECT_STATUS.PENDING,
    startTime: { $exists: false },
  }).sort({ createdAt: 1 });

  logs.map((log) => {
    const diff = Date.now() - new Date(log.createdAt).getTime();
    if (diff > 300000) {
      return useRabbitMQ(
        "main",
        "send",
        JSON.stringify({
          event: "redeploy",
          data: { projectId: log.project, logId: log._id },
        })
      );
    }
  });
};

export const pendingCron = cron.schedule(
  "* * * * *",
  () => processPendingLogs(),
  { scheduled: false }
);
