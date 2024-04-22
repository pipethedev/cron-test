import { Log, PROJECT_STATUS, Preview, Project } from "@brimble/models";
import { useRabbitMQ } from "../config";
import cron from "node-cron";
import { subDays } from "date-fns";

export const removeContainers = cron.schedule(
  "0 0 * * *",
  async () => {
    const projects = await Project.find().select("log");
    const previews = await Preview.find().select("log");
    const logIds = [...projects, ...previews].map((x) => x.log);
    const logs = await Log.find({
      status: {
        $not: { $in: [PROJECT_STATUS.PENDING, PROJECT_STATUS.INPROGRESS] },
      },
      _id: { $not: { $in: logIds } },
      createdAt: { $gt: subDays(new Date(), 2).toISOString() },
    })
      .select("name")
      .sort({ createdAt: -1 });
    const keys = logs.map((log) => log.name).filter(Boolean);

    for (let i = 0; i < 5; i++) {
      useRabbitMQ(
        `s${i + 1}`,
        "send",
        JSON.stringify({
          event: "container:kill",
          data: { containers: keys },
        })
      );
    }
  },
  { scheduled: false }
);
