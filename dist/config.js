"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxy = exports.queue = exports.socket = void 0;
const socket_io_client_1 = require("socket.io-client");
const dotenv_1 = __importDefault(require("dotenv"));
const bullmq_1 = require("bullmq");
const redis_client_1 = require("./redis/redis-client");
const tsyringe_1 = require("tsyringe");
require("dotenv").config();
const redbird = require("redbird")({
    port: process.env.PROXY_PORT || 9999,
    silent: true,
});
dotenv_1.default.config();
const redis = tsyringe_1.container.resolve((0, tsyringe_1.delay)(() => redis_client_1.RedisClient));
exports.socket = (0, socket_io_client_1.io)(`http://127.0.0.1:${process.env.PORT || 5000}`);
const queue = (name) => new bullmq_1.Queue(name, {
    connection: redis.get().duplicate(),
    defaultJobOptions: {
        removeOnComplete: true,
    },
});
exports.queue = queue;
exports.proxy = {
    // create a register function to register the domain with the proxy
    register(domain, ip, { id, isWatchMode }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                redbird.register(domain, ip);
                if (!isWatchMode) {
                    if (id) {
                        exports.socket.emit(`${id}-domain_mapped`, {
                            message: "Domain mapped successfully",
                            domain: `${process.env.NODE_ENV !== "production" ? "http" : "https"}://${domain}`,
                        });
                    }
                    else {
                        exports.socket.emit("domain-success", {
                            message: "Proxy server started",
                            domain: `${process.env.NODE_ENV !== "production" ? "http" : "https"}://${domain}`,
                        });
                    }
                }
            }
            catch (err) {
                console.error(err);
            }
        });
    },
    // create an unregister function to unregister the domain with the proxy
    unregister(domain) {
        redbird.unregister(domain);
    },
    changeDefault() {
        redbird.notFound((req, res) => {
            // TODO: Create Brimble 404 page
            const host = req.headers.host;
            const requestId = req.headers["x-brimble-id"];
            res.statusCode = 404;
            res.end(`Deployment not found for ${host}`);
        });
    },
};
