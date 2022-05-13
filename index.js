const { pusher, pusherClient } = require("./config");
const { sslWorker } = require("./worker/ssl");

const proxy = require("redbird")({
  port: process.env.PROXY_PORT || 9999,
  silent: true,
});

const channel = pusherClient.subscribe("domain");

channel.bind("register", ({ domain, ip }) => {
  try {
    proxy.register(domain, ip);
    setTimeout(() => {
      pusher.trigger("domain", "success", {
        message: "Proxy server started",
        domain: `${
          process.env.NODE_ENV !== "production" ? "http" : "https"
        }://${domain}`,
      });
    }, 2000);
  } catch (err) {
    console.error(err);
  }
});

channel.bind("unregister", ({ domain }) => {
  proxy.unregister(domain);
});

channel.bind("ssl", ({ domain }) => {
  sslWorker.add({ domain });
});
