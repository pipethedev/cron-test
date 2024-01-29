import amqp, { Connection, Channel } from "amqplib";
import dotenv from "dotenv";
dotenv.config();

export class RabbitMQ {
  private connection!: Connection;
  private channel!: Channel;

  async connect() {
    this.connection = await amqp.connect(
      `${process.env.RABBITMQ_URL || "amqp://localhost:5672"}`,
      { reconnect: true, heartbeat: 60 }
    );
    this.channel = await this.connection.createChannel();

    this.connection.on("error", (error) => {
      console.error(`A RabbitMQ connection error occurred: ${error}`);
      if (process.env.NODE_ENV === "production") process.exit(1);
    });
  }

  async sendMessage(queueName: string, message: string) {
    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.sendToQueue(queueName, Buffer.from(message));
  }

  async consume(queueName: string, onMessage: (message: any) => void) {
    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.consume(queueName, (message) => {
      if (message) {
        onMessage(message.content.toString());
        this.channel.ack(message, true);
      }
    });
  }

  async close() {
    await this.channel.close();
    await this.connection.close();
  }
}

export const rabbitMQ = new RabbitMQ();
