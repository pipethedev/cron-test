import amqp, { Connection, Channel } from "amqplib";
import dotenv from "dotenv";
dotenv.config();

export class RabbitMQ {
  private connection!: Connection;
  private channel!: Channel;

  async connect() {
    this.connection = await amqp.connect(
      {
        protocol: process.env.RABBITMQ_PROTOCOL || "amqp",
        hostname: process.env.RABBITMQ_HOST || "localhost",
        port: Number(process.env.RABBITMQ_PORT) || 5672,
        username: process.env.RABBITMQ_USER || "guest",
        password: process.env.RABBITMQ_PASS || "guest",
        vhost: process.env.RABBITMQ_VHOST || "/",
      },
      { reconnect: true, heartbeat: 60 }
    );
    this.channel = await this.connection.createChannel();

    this.connection.on("error", (error) => {
      console.error(`A RabbitMQ connection error occurred: ${error}`);
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
