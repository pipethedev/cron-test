import cron from "node-cron";
import { useRabbitMQ } from "../config";
import { keepInSync } from "../worker/sync";

const useScheduler = () => {
  const syncScheduler = cron.schedule("*/30 * * * *", () => keepInSync());
  const rabbitMqScheduler = cron.schedule("*/2 * * * *", () =>
    useRabbitMQ("main", "consume")
  );

  return [syncScheduler, rabbitMqScheduler];
};

export default useScheduler;
