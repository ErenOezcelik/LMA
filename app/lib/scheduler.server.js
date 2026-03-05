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

  // Run initial sync immediately on boot
  console.log("Running initial email sync...");
  syncEmails()
    .then((result) => {
      if (result.skipped) {
        console.log("Initial sync skipped (already running)");
      } else {
        console.log(`Initial sync done: ${result.processed} new emails`);
      }
    })
    .catch((err) => console.error("Initial sync failed:", err.message));

  // Then schedule recurring sync
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
