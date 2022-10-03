import Redis from "ioredis";
import { singleton } from "tsyringe";

@singleton()
export class RedisClient {
  private client: Redis | undefined;

  get() {
    this.client = this.client || this.createClient();

    return this.client;
  }

  async close() {
    await this.get().disconnect();
  }

  private createClient() {
    const retryStrategy = (attempts: number) => {
      const delay = Math.min(attempts * 1000, 15000);
      return delay;
    };

    const redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || "",
      username: process.env.REDIS_USERNAME as string,
      showFriendlyErrorStack: true,
      retryStrategy,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      db: 0,
    });

    redisClient.on("error", (err) => {
        console.log({ err }, "Redis client connection error");
    });

    redisClient.on("ready", () => {
        console.log("Redis client is ready");
    });

    redisClient.on("reconnecting", () => {
        console.log("Redis client is reconnected");
    });

    return redisClient;
  }
}