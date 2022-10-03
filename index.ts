import "reflect-metadata";
import { proxy, socket } from "./config";
import { connectToMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { KeepSyncQueue } from "./queue/keep-sync.queue";
import { RedisClient } from "./redis/redis-client";

connectToMongo(process.env.MONGODB_URI || "");

const keepInSync = container.resolve(delay(() => KeepSyncQueue));
const redisClient = container.resolve(delay(() => RedisClient));

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.PORT || 5000}`,
  {}
);

keepInSync.startWorker();

socket.on("domain-register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, { id });
});

socket.on("domain-unregister", ({ domain }) => {
  proxy.unregister(domain);
});


socket.on('end', function (){
  socket.disconnect();
  socket.close();
});

process.on('SIGTERM', closeApp);
process.on('SIGINT', closeApp);

function closeApp(){
  socket.disconnect();
  socket.close();
  keepInSync.closeWorker();
  redisClient.close();
  process.exit(0);
}
