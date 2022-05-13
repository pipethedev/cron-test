const { spawn } = require("child_process");
const { queue, pusher } = require("../config");

const sslWorker = queue("ssl");

sslWorker.process(async (job, done) => {
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

    if (output.includes("Certificate is saved at:")) {
      const cert = output.match(
        /\/etc\/letsencrypt\/live\/[^\/]+\/fullchain.pem/
      );
      const key = output.match(/\/etc\/letsencrypt\/live\/[^\/]+\/privkey.pem/);

      // append to nginx config
      const nginxConfig = `\n
      server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name ${domain};
        ssl_certificate ${cert[0]};
        ssl_certificate_key ${key[0]};
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
      require("fs").appendFileSync(nginxPath, nginxConfig);

      // reload nginx
      require("child_process").execSync("systemctl reload nginx");

      // complete job with success message
      job.progress(100);
      done(null, {
        message: `SSL certificate for ${domain} has been generated`,
        domain,
      });
    }
  });

  child.stderr.on("data", (data, done) => {
    // complete job with error message
    done(new Error(data.toString()));
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
    domain: job.data.domain,
  });
});

module.exports = {
  sslWorker,
};
