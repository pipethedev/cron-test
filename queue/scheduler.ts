import cron from "node-cron";
import { useRabbitMQ } from "../config";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const scheduler = cron.schedule("*/30 * * * *", () => keepInSync());
  cron.schedule("*/2 * * * *", () => useRabbitMQ("main", "consume"));

  return scheduler;
};

export default useScheduler;
