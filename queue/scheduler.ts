import cron from "node-cron";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const syncScheduler = cron.schedule("*/5 * * * *", () => keepInSync());

  return [syncScheduler];
};

export default useScheduler;
