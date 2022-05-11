const Pusher = require("pusher");
const PusherJs = require("pusher-js");
const dotenv = require("dotenv");

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

module.exports = {
  pusher,
  pusherClient,
};
