const { spawn } = require("child_process");
const { queue, pusher } = require("../config");

const sslWorker = queue("ssl");

sslWorker.process(async (job) => {
  const { domain } = job.data;
  const child = spawn("certbot", [
    "certonly",
    "--nginx",
    "-d",
    domain,
    "--agree-tos",
    "--non-interactive",
    "--text",
    "--no-eff-email",
    "--force-renewal",
  ]);

  child.stdout.on("data", (data) => {
    const output = data.toString();

    // get Certificate is saved at:
    // /etc/letsencrypt/live/example.com/cert.pem
    // and Key is saved at:
    // /etc/letsencrypt/live/example.com/privkey.pem
    if (output.includes("Certificate is saved at:")) {
      // write to nginx
      const cert = output.split("Certificate is saved at:")[1].trim();
      const key = output.split("Key is saved at:")[1].trim();

      // append to nginx config
      const nginxConfig = `
      server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name ${domain};
        ssl_certificate ${cert};
        ssl_certificate_key ${key};
        ssl_session_timeout 5m;
      
        location / {
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-NginX-Proxy true;
          proxy_pass ${process.env.PROXY_URL || "http://127.0.0.1:9000"};
          proxy_ssl_session_reuse off;
          proxy_set_header Host $http_host;
          proxy_cache_bypass $http_upgrade;
          proxy_redirect off;
        }
      }
    `;

      const nginxPath = "/etc/nginx/sites-enabled/bookily.xyz";

      // append to nginx config
      require("fs").writeFileSync(nginxPath, nginxConfig);

      // reload nginx
      require("child_process").execSync("systemctl reload nginx");

      // complete job with success message
      job.progress(100);
      job.done({
        message: `SSL certificate for ${domain} has been generated`,
        domain,
      });
    }
  });

  child.stderr.on("data", (data) => {
    // complete job with error message
    job.progress(100);
    job.fail({
      message: data.toString(),
      domain,
    });
  });
});

sslWorker.on("completed", (job, payload) => {
  pusher.trigger("domain", "success", {
    message: payload.message,
    domain: payload.domain,
  });
});

sslWorker.on("failed", (job, err) => {
  pusher.trigger("domain", "error", {
    message: err.message,
    domain: err.domain,
  });
});

module.exports = {
  sslWorker,
};
