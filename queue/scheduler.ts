import cron from "node-cron";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const syncScheduler = cron.schedule(process.env.CRON || "*/5 * * * *", () =>
    keepInSync({ checkLast: true })
  );

  return [syncScheduler];
};

export default useScheduler;
