import amqp, { Connection, Channel } from "amqplib";

export class RabbitMQ {
  private connection!: Connection;
  private channel!: Channel;

  constructor(private uri: string) {}

  async connect() {
    this.connection = await amqp.connect(this.uri, {
      reconnect: true,
      heartbeat: 60,
    });
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

export const rabbitMQ = new RabbitMQ(
  process.env.RABBITMQ_URI || "amqp://localhost"
);
