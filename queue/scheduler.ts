import cron from "node-cron";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const scheduler = cron.schedule("*/5 * * * *", () => keepInSync());

  return scheduler;
};

export default useScheduler;
