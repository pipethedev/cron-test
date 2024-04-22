import { uptime } from "./uptime.job";
import { pending } from "./pending.job";
import { removeContainers } from "./rm.container.job";

export const jobs = { uptime, pending, removeContainers };
