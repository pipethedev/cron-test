import cron from "node-cron";
import mongoose from "mongoose";

const db = mongoose.connection.db;

export const deleteProjectsPermanently = cron.schedule(
  "59 23 * * *",
  async () => {
    await db.collection('projects').deleteMany({
        billable: { $ne: true },
        isDeleted: true,
        deletedAt: { $exists: true }
    }).then(() => {
        console.log("Deleted projects permanently");
    });
  },
  { scheduled: false }
);
