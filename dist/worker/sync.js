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
exports.keepInSyncWorker = exports.keepInSync = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const models_1 = require("@brimble/models");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const tsyringe_1 = require("tsyringe");
const keep_sync_queue_1 = require("../queue/keep-sync.queue");
const projectSync = tsyringe_1.container.resolve((0, tsyringe_1.delay)(() => keep_sync_queue_1.KeepSyncQueue));
const keepInSync = ({ project }) => __awaiter(void 0, void 0, void 0, function* () {
    projectSync.execute({});
    if (project) {
        const { interval } = project;
        projectSync.execute({}, { cron: interval || "*/1 * * * *" });
    }
});
exports.keepInSync = keepInSync;
const keepInSyncWorker = (job, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield models_1.Project.find({}).populate("domains");
        yield Promise.all(projects.map((project) => __awaiter(void 0, void 0, void 0, function* () {
            const { domains, port, dir, outputDirectory, buildCommand, name, rootDir, } = project;
            const urlString = `http://127.0.0.1:${port}`;
            if (!dir) {
                console.log(`${name} is not properly configured`);
            }
            else if (!fs_1.default.existsSync(dir)) {
                console.log(`${dir} does not exist`);
            }
            else {
                try {
                    yield (0, axios_1.default)(urlString);
                    domains.forEach((domain) => {
                        config_1.proxy.register(domain.name, urlString, { isWatchMode: true });
                    });
                    console.log(`${name} is properly configured`);
                }
                catch (error) {
                    try {
                        const deployLog = `${dir}/deploy.log`;
                        const fileDir = rootDir ? path_1.default.join(dir, rootDir) : dir;
                        (0, child_process_1.spawn)("nohup", [
                            "brimble",
                            "dev",
                            `${fileDir}`,
                            `${port && `"-p ${port}"`}`,
                            "-so",
                            buildCommand && "--build-command",
                            buildCommand && `"${buildCommand}"`,
                            outputDirectory && "--output-directory",
                            outputDirectory && `"${outputDirectory}"`,
                            ">",
                            deployLog,
                            "&",
                        ], {
                            shell: true,
                        });
                        const watcher = (0, child_process_1.spawn)("tail", ["-f", deployLog]);
                        watcher.stdout.on("data", (data) => __awaiter(void 0, void 0, void 0, function* () {
                            const log = data.toString();
                            log.split("\n").forEach((line) => {
                                const lowerCaseLine = line.toLowerCase();
                                if (lowerCaseLine.includes("failed")) {
                                    watcher.kill();
                                }
                            });
                            const pid = log.match(/PID: \d+/g);
                            const url = log.match(/http:\/\/[a-zA-Z0-9-.]+:[0-9]+/g);
                            if (url && pid) {
                                let urlString = url[0];
                                const port = urlString.match(/:[0-9]+/g);
                                urlString = urlString.replace("localhost", "127.0.0.1");
                                if (project) {
                                    const oldPort = project.port, oldPid = project.pid;
                                    project.pid = pid === null || pid === void 0 ? void 0 : pid[0].split(":")[1].trim();
                                    project.port = port === null || port === void 0 ? void 0 : port[0].split(":")[1].trim();
                                    yield project.save();
                                    domains.forEach((domain) => {
                                        config_1.proxy.register(domain.name, urlString, {
                                            isWatchMode: true,
                                        });
                                        config_1.socket.emit("domain:clear_cache", { domain: domain.name });
                                    });
                                    (0, child_process_1.spawn)("kill", [`${oldPid}`]);
                                    (0, child_process_1.spawn)("kill", ["-9", `lsof -t -i:${oldPort}`]);
                                }
                                console.log(`${project === null || project === void 0 ? void 0 : project.name} redeployed`);
                                watcher.kill();
                            }
                        }));
                    }
                    catch (error) {
                        console.log(`${name} couldn't start | ${error.message}`);
                    }
                }
            }
        })));
        done();
    }
    catch (error) {
        console.log(error);
    }
});
exports.keepInSyncWorker = keepInSyncWorker;
