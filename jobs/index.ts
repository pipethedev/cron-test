import { uptime } from "./uptime.job";
import { pending } from "./pending.job";
import { removeContainers } from "./rm.container.job";
import { backup } from "./backup.job";

export const jobs = { uptime, pending, removeContainers, backup };
