import { Log, PROJECT_STATUS } from "@brimble/models";
import { useRabbitMQ } from "../config";
import cron from "node-cron";

export const pending = cron.schedule(
  "* * * * *",
  async () => {
    const logs = await Log.find({
      status: PROJECT_STATUS.PENDING,
      startTime: { $exists: false },
    }).sort({ createdAt: 1 });

    await Promise.all(
      logs.map(async (log) => {
        const logs = await Log.find({
          user: log.user,
          status: PROJECT_STATUS.INPROGRESS,
        });

        if (!logs.length) {
          console.log(`Force trigging deployment for ${log.name}`);
          return useRabbitMQ(
            "main",
            "send",
            JSON.stringify({
              event: "redeploy",
              data: { projectId: log.project, logId: log._id },
            })
          );
        }
      })
    );
  },
  { scheduled: false }
);
