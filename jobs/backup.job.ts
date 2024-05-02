import cron from "node-cron";
import { exec } from "child_process";

export const backup = cron.schedule(
  "0 */6 * * *",
  async () => {
    exec("cp -r /etc/caddy/Caddy /brimble/configurations/caddy");
    exec("cp -r /mnt/caddy/sites /brimble/configurations/caddy");
    exec("cp -r /etc/bind /brimble/configurations/bind9");

    exec(
      "cd /brimble/configurations && git add . && git commit -m 'auto backup' && git push"
    );
  },
  { scheduled: false }
);
