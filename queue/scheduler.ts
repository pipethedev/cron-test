import cron from "node-cron";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const scheduler = cron.schedule("*/30 * * * *", () => keepInSync());

  return scheduler;
};

export default useScheduler;