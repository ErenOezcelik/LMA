import { prisma } from "./db.server.js";
import { fetchEmails } from "./ews.server.js";
import { classifyEmail } from "./classifier.server.js";

const BATCH_SIZE = 10;
const ESCALATION_THRESHOLD = parseFloat(process.env.ESCALATION_THRESHOLD || "0.8");

export async function syncEmails() {
  // Check if sync is already running
  let syncStatus = await prisma.syncStatus.findUnique({ where: { id: "singleton" } });
  if (syncStatus?.isRunning) {
    console.log("Sync already running, skipping...");
    return { skipped: true };
  }

  // Mark sync as running
  await prisma.syncStatus.upsert({
    where: { id: "singleton" },
    update: { isRunning: true },
    create: { id: "singleton", isRunning: true },
  });

  try {
    const since = syncStatus?.lastSyncAt || null;
    console.log(`Fetching emails since ${since || "today"}...`);

    const emails = await fetchEmails(since);
    console.log(`Found ${emails.length} emails from Exchange`);

    // Dedup: filter out emails already in DB
    const existingIds = new Set(
      (
        await prisma.email.findMany({
          where: { exchangeId: { in: emails.map((e) => e.exchangeId) } },
          select: { exchangeId: true },
        })
      ).map((e) => e.exchangeId)
    );

    const newEmails = emails.filter((e) => !existingIds.has(e.exchangeId));
    console.log(`${newEmails.length} new emails to classify`);

    let processed = 0;

    // Process in batches
    for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
      const batch = newEmails.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (email) => {
          const classification = await classifyEmail(email);
          return { email, classification };
        })
      );

      for (const { email, classification } of results) {
        await prisma.email.create({
          data: {
            exchangeId: email.exchangeId,
            subject: email.subject,
            sender: email.sender,
            senderName: email.senderName,
            bodyText: email.bodyText,
            bodyPreview: email.bodyPreview,
            receivedDate: email.receivedDate,
            bucket: classification.bucket,
            importanceScore: classification.importanceScore,
            isEscalated: classification.importanceScore >= ESCALATION_THRESHOLD,
            rawResponse: classification.rawResponse,
          },
        });
        processed++;
      }
    }

    // Update sync status
    await prisma.syncStatus.update({
      where: { id: "singleton" },
      data: {
        isRunning: false,
        lastSyncAt: new Date(),
        lastSyncCount: processed,
      },
    });

    console.log(`Sync complete: ${processed} emails processed`);
    return { processed, total: emails.length, newEmails: newEmails.length };
  } catch (err) {
    // Reset sync status on failure
    await prisma.syncStatus.update({
      where: { id: "singleton" },
      data: { isRunning: false },
    });
    console.error("Sync failed:", err);
    throw err;
  }
}
