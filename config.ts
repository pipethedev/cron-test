import dotenv from "dotenv";
import { rabbitMQ } from "./rabbitmq";
dotenv.config();

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
    console.error("Failed to publish message:", err);
    if (process.env.NODE_ENV === "production") process.exit(1);
  }
};
