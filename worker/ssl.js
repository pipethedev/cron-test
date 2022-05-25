const { spawn } = require("child_process");
const { queue, pusher } = require("../config");

const sslWorker = queue("ssl");

sslWorker.process(async (job, done) => {
  const { domain } = job.data;
  let subdomain = "";
  if (!domain.includes("www.")) {
    subdomain = `www.${domain}`;
  }

  // check if domain already has ssl using letsencrypt and certbot
  const check = spawn("certbot", ["certificates"]);

  check.stdout.on("data", (data) => {
    const output = data.toString();
    if (output.includes(domain) || output.includes(subdomain)) {
      done(null, {
        status: "success",
        message: `${domain} already has ssl`,
      });
    }

    const generate = spawn("certbot", [
      "certonly",
      "--nginx",
      "-d",
      domain,
      subdomain ? "-d" : "",
      subdomain ? subdomain : "",
      "--agree-tos",
      "--non-interactive",
      "--text",
      "--no-eff-email",
      "--force-renewal",
    ]);

    generate.stdout.on("data", (data) => {
      const output = data.toString();

      const cert = output.match(
        /\/etc\/letsencrypt\/live\/[^\/]+\/fullchain.pem/
      );
      const key = output.match(/\/etc\/letsencrypt\/live\/[^\/]+\/privkey.pem/);
      if (cert && key) {
        // append to nginx config
        const nginxConfig = `\n
        server {
          listen 443 ssl http2;
          listen [::]:443 ssl http2;
          server_name ${domain} ${subdomain || ""};
          ssl_certificate ${cert[0]};
          ssl_certificate_key ${key[0]};
          ssl_session_timeout 5m;
        
          location / {
            include proxy_params;
            proxy_cache my_cache;
            proxy_cache_revalidate on;
            proxy_cache_min_uses 3;
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
            proxy_cache_background_update on;
            proxy_cache_lock on;
            
            proxy_pass http://backend;
            add_header x-brimble-cache $upstream_cache_status;
          }
        }
      `;

        const nginxPath = `${
          process.env.NGINX_CONFIG_PATH || "/etc/nginx/conf.d"
        }`;

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

    generate.on("close", (code) => {
      if (code !== 0) {
        done(new Error(`Error generating ssl for ${domain}: ${code}`));
      }
    });

    generate.on("error", (error) => {
      done(new Error(`Error generating ssl for ${domain}: ${error}`));
    });
  });

  check.on("close", (code) => {
    if (code !== 0) {
      done(new Error(`Error checking for ssl for ${domain}: ${code}`));
    }
  });

  check.on("error", (error) => {
    done(new Error(`Error checking for ssl for ${domain}: ${error}`));
  });
});

sslWorker.on("completed", (job, payload) => {
  if (job.data.id) {
    pusher
      .trigger(job.data.id, "ssl_generated", { ...payload })
      .catch((error) => {
        console.log(error);
      });
  } else {
    pusher.trigger("domain", "success", { ...payload }).catch((error) => {
      console.log(error);
    });
  }
});

sslWorker.on("failed", (job, err) => {
  if (job.data.id) {
    pusher
      .trigger(job.data.id, "ssl_failed", {
        message: err.message,
        domain: job.data.domain,
      })
      .catch((error) => {
        console.log(error);
      });
  } else {
    pusher
      .trigger("domain", "error", {
        message: err.message,
        domain: job.data.domain,
      })
      .catch((error) => {
        console.log(error);
      });
  }
});

module.exports = {
  sslWorker,
};
