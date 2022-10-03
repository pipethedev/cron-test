"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const config_1 = require("./config");
const models_1 = require("@brimble/models");
const tsyringe_1 = require("tsyringe");
const keep_sync_queue_1 = require("./queue/keep-sync.queue");
const redis_client_1 = require("./redis/redis-client");
const worker_1 = require("./worker");
(0, models_1.connectToMongo)(process.env.MONGODB_URI || "");
const sync = tsyringe_1.container.resolve((0, tsyringe_1.delay)(() => keep_sync_queue_1.KeepSyncQueue));
const redisClient = tsyringe_1.container.resolve((0, tsyringe_1.delay)(() => redis_client_1.RedisClient));
config_1.proxy.changeDefault();
config_1.proxy.register(process.env.DOMAIN || "brimble.test", `http://127.0.0.1:${process.env.PORT || 5000}`, {});
(0, worker_1.keepInSync)({ project: { interval: process.env.SYNC_INTERVAL } });
sync.startWorker();
config_1.socket.on("domain-register", ({ domain, ip, id }) => {
    config_1.proxy.unregister(domain);
    config_1.proxy.register(domain, ip, { id });
});
config_1.socket.on("domain-unregister", ({ domain }) => {
    config_1.proxy.unregister(domain);
});
config_1.socket.on('end', function () {
    config_1.socket.disconnect();
    config_1.socket.close();
});
process.on('SIGTERM', closeApp);
process.on('SIGINT', closeApp);
function closeApp() {
    console.log("Shutting down gracefully");
    config_1.socket.disconnect();
    config_1.socket.close();
    sync.closeWorker();
    redisClient.close();
    process.exit(0);
}
