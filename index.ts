import "reflect-metadata";
import restana from "restana";
import { proxy, socket } from "./config";
import { connectToMongo, closeMongo } from "@brimble/models";
import { container, delay } from "tsyringe";
import { KeepSyncQueue } from "./queue/keep-sync.queue";
import { RedisClient } from "./redis/redis-client";
import { keepInSync } from "./worker/sync";

connectToMongo(process.env.MONGODB_URI || "");

const service = restana({});
const sync = container.resolve(delay(() => KeepSyncQueue));
const redisClient = container.resolve(delay(() => RedisClient));

proxy.changeDefault();
proxy.register(
  process.env.DOMAIN || "brimble.test",
  `http://127.0.0.1:${process.env.API_PORT || 5000}`,
  {}
);
proxy.register(
  `${process.env.DOMAIN}/proxy` || "brimble.test/proxy",
  `http://127.0.0.1:${process.env.PORT || 3000}`,
  {}
);

sync.startWorker();

service.get("/", (_, res) => {
  return res.send({
    status: 200,
    message: "Proxy server running",
  });
});

const checkHeader = (req: any, res: any, next: any) => {
  const token = req.headers["x-proxy-token"];

  if (token && token === process.env.SECRET) {
    next();
  } else {
    res.send(401, { message: "Unauthorized" });
  }
};

service.post("/", checkHeader, (_, res) => keepInSync());

socket.on("domain-register", ({ domain, ip, id }) => {
  proxy.unregister(domain);
  proxy.register(domain, ip, { id });
});

socket.on("domain-unregister", ({ domain }) => {
  proxy.unregister(domain);
});

socket.on("end", function () {
  socket.disconnect();
  socket.close();
});

process.on("SIGTERM", closeApp);
process.on("SIGINT", closeApp);

service.start(Number(process.env.PORT) || 3000);

function closeApp() {
  console.log("Shutting down gracefully");
  socket.disconnect();
  socket.close();
  sync.closeWorker();
  redisClient.close();
  closeMongo();
  service.close();
  process.exit(0);
}
