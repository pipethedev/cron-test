import { Queue, Worker } from "bullmq";
import { container, delay, injectable } from "tsyringe";
import { queue } from "../config";
import { RedisClient } from "../redis/redis-client";
import { keepInSyncWorker } from "../worker/sync";

const redis = container.resolve(delay(() => RedisClient));

@injectable()
export class KeepSyncQueue {
  public queueName: string = "project_sync";
  private keepSyncQueue = queue(this.queueName);
  private worker: Worker = new Worker(this.queueName, keepInSyncWorker, {
    autorun: false,
    connection: redis.get().duplicate(),
  });

  async startWorker() {
    this.worker.run();

    console.log("Keep in sync worker started");
  }

  async execute(data: any) {
    await (this.keepSyncQueue as Queue).add(this.queueName, data);
  }

  async executeBulk(data: any[]) {
    await (this.keepSyncQueue as Queue).drain();
    await (this.keepSyncQueue as Queue).addBulk(data);
  }

  async closeWorker() {
    this.worker && (await this.worker.close());

    console.log("Keep in sync worker closed/exited");
  }
}
