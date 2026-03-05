import cron from "node-cron";
import { syncEmails } from "./sync.server.js";

let task = null;

export function startScheduler() {
  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || "5", 10);

  if (task) {
    console.log("Scheduler already running");
    return;
  }

  console.log(`Starting email sync scheduler (every ${intervalMinutes} minutes)`);

  task = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
    console.log(`[${new Date().toLocaleTimeString("de-DE")}] Running scheduled email sync...`);
    try {
      const result = await syncEmails();
      if (result.skipped) {
        console.log("Sync skipped (already running)");
      } else {
        console.log(`Sync done: ${result.processed} new emails`);
      }
    } catch (err) {
      console.error("Scheduled sync failed:", err.message);
    }
  });
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
    console.log("Scheduler stopped");
  }
}
