import { PROJECT_STATUS, Log, Domain } from "@brimble/models";
import cron from "node-cron";
import { useRabbitMQ } from "../config";
import axios from "axios";

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

export const uptimeCron = cron.schedule(
  "*/10 * * * *",
  async () => {
    const domains = await Domain.find({
      name: { $regex: ".brimble.app" },
      preview: { $exists: false },
    })
      .select("name project")
      .populate({ path: "project", select: "isPaused" });

    await Promise.all(
      domains.map(async (domain) => {
        const project = domain.project;
        if (project && !project?.isPaused) {
          const url = `https://${domain?.name}`;
          await axios(url, {
            headers: { "user-agent": "Uptime" },
            timeout: 30000,
          }).catch(() => {});
        }
      })
    );
  },
  { scheduled: false }
);

export const pendingCron = cron.schedule(
  "* * * * *",
  () => processPendingLogs(),
  { scheduled: false }
);
