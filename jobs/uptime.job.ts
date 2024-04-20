import { Domain } from "@brimble/models";
import axios from "axios";
import cron from "node-cron";

export const uptime = cron.schedule(
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
