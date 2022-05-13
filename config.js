const Pusher = require("pusher");
const PusherJs = require("pusher-js");
const dotenv = require("dotenv");
const Queue = require("bull");

dotenv.config();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_APP_KEY || "",
  secret: process.env.PUSHER_APP_SECRET || "",
  cluster: process.env.PUSHER_APP_CLUSTER || "eu",
});

const pusherClient = new PusherJs(process.env.PUSHER_APP_KEY || "", {
  cluster: "eu",
});

const queue = (background_name) =>
  new Queue(background_name, {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || "",
    },
  });

module.exports = {
  pusher,
  pusherClient,
  queue,
};
