import { Job, Queue, Worker } from "bullmq";
import { container, delay, injectable } from "tsyringe";
import { queue } from "../config";
import { RedisClient } from "../redis/redis-client";

const redis = container.resolve(delay(() => RedisClient));

@injectable()
export class QueueClass {
  private keepSyncQueue: Queue;
  private worker: Worker;

  constructor(
    private queueName: string,
    workerFunction: (job: Job) => Promise<any>
  ) {
    this.keepSyncQueue = queue(queueName);
    this.worker = new Worker(queueName, workerFunction, {
      connection: redis.get().duplicate(),
    });
  }

  async execute(data: any) {
    await this.keepSyncQueue.drain();
    await this.keepSyncQueue.add(this.queueName, data);
  }

  async executeBulk(payload: any[]) {
    await this.keepSyncQueue.drain();
    await this.keepSyncQueue.addBulk(
      payload.map((data) => ({ name: this.queueName, ...data }))
    );
  }

  async closeWorker() {
    await this.worker.close();
    console.log(`${this.queueName} worker closed/exited`);
  }
}
