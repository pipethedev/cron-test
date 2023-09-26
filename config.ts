import dotenv from "dotenv";
import { Queue } from "bullmq";
import { RedisClient } from "./redis/redis-client";
import { container, delay } from "tsyringe";
import { rabbitMQ } from "./rabbitmq";
dotenv.config();

export const redis = container.resolve(delay(() => RedisClient)).get();

export const queue = (name: string) =>
  new Queue(name, {
    connection: redis.duplicate(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

const connection = rabbitMQ;
const connect = connection.connect();
export const useRabbitMQ = async (
  name: string,
  type: "send" | "consume",
  message?: string
) => {
  try {
    await connect;

    if (type === "send" && message) {
      await connection.sendMessage(name, message);
    } else if (type === "consume") {
      await connection.consume(name, (msg) => {
        if (msg) {
          const { event, data } = JSON.parse(msg.toString());
          console.info({ event, data });
        }
      });
    } else {
      throw new Error("Invalid type");
    }
  } catch (err) {
    console.error(err);
  }
};

export const prioritize = [
  "brimble-client",
  "brimble-dashboard",
  "webshots",
  "klefdev",
  "ileri",
];

export const randomDelay = async (min: number, max: number) => {
  // Generate a random delay between min and max milliseconds
  const delay = Math.random() * (max - min) + min;
  await new Promise((resolve) => setTimeout(resolve, delay));
};
