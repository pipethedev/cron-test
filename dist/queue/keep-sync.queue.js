"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeepSyncQueue = void 0;
const bullmq_1 = require("bullmq");
const tsyringe_1 = require("tsyringe");
const config_1 = require("../config");
const redis_client_1 = require("../redis/redis-client");
const sync_1 = require("../worker/sync");
const redis = tsyringe_1.container.resolve((0, tsyringe_1.delay)(() => redis_client_1.RedisClient));
let KeepSyncQueue = class KeepSyncQueue {
    constructor() {
        this.queueName = "project_sync";
        this.worker = new bullmq_1.Worker(this.queueName, sync_1.keepInSyncWorker, {
            autorun: false,
            connection: redis.get().duplicate(),
        });
    }
    startWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            // initialize queue
            this.keepSyncQueue = (0, config_1.queue)(this.queueName);
            this.worker.run();
            console.log("Keep in sync worker started");
        });
    }
    execute(data, cronInterval) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            yield ((_a = this.keepSyncQueue) === null || _a === void 0 ? void 0 : _a.add(this.queueName, data, {
                attempts: 5,
                priority: 1,
                repeat: cronInterval,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
            }));
        });
    }
    closeWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            this.worker && (yield this.worker.close());
            console.log("Keep in sync worker closed/exited");
        });
    }
};
KeepSyncQueue = __decorate([
    (0, tsyringe_1.injectable)()
], KeepSyncQueue);
exports.KeepSyncQueue = KeepSyncQueue;
