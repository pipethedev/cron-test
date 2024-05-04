import cron from "node-cron";
import { execSync } from "child_process";

export const backup = cron.schedule(
  "0 */6 * * *",
  async () => {
    execSync("cp -r /etc/caddy/Caddyfile /brimble/configurations/caddy");
    execSync("cp -r /mnt/caddy/sites /brimble/configurations/caddy");
    execSync("cp -r /etc/bind /brimble/configurations/bind9");

    execSync(
      "cd /brimble/configurations && git add . && git commit -m 'auto backup' && git push origin main"
    );
  },
  { scheduled: false }
);
