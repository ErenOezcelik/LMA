import { prisma } from "./db.server.js";
import { fetchEmails } from "./imap.server.js";

export async function syncEmails() {
  let syncStatus = await prisma.syncStatus.findUnique({ where: { id: "singleton" } });
  if (syncStatus?.isRunning) {
    console.log("Sync already running, skipping...");
    return { skipped: true };
  }

  await prisma.syncStatus.upsert({
    where: { id: "singleton" },
    update: { isRunning: true },
    create: { id: "singleton", isRunning: true },
  });

  try {
    let since;
    if (syncStatus?.lastSyncAt) {
      since = syncStatus.lastSyncAt;
    } else {
      // First run: fetch last 5 days
      since = new Date();
      since.setDate(since.getDate() - 5);
      since.setHours(0, 0, 0, 0);
    }

    console.log(`Sync: Fetching emails since ${since.toISOString()}...`);

    const emails = await fetchEmails(since);
    console.log(`Sync: Found ${emails.length} emails from IMAP`);

    // Dedup against DB
    const existingIds = new Set(
      (
        await prisma.email.findMany({
          where: { exchangeId: { in: emails.map((e) => e.exchangeId) } },
          select: { exchangeId: true },
        })
      ).map((e) => e.exchangeId)
    );

    const newEmails = emails.filter((e) => !existingIds.has(e.exchangeId));
    console.log(`Sync: ${newEmails.length} new emails to store`);

    let processed = 0;

    for (const email of newEmails) {
      await prisma.email.create({
        data: {
          exchangeId: email.exchangeId,
          subject: email.subject,
          sender: email.sender,
          senderName: email.senderName,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml || "",
          bodyPreview: email.bodyPreview,
          receivedDate: new Date(email.receivedDate),
          bucket: "rest",
          importanceScore: 0,
          isEscalated: false,
        },
      });
      processed++;
    }

    await prisma.syncStatus.update({
      where: { id: "singleton" },
      data: {
        isRunning: false,
        lastSyncAt: new Date(),
        lastSyncCount: processed,
      },
    });

    console.log(`Sync complete: ${processed} new emails stored`);
    return { processed, total: emails.length, newEmails: newEmails.length };
  } catch (err) {
    await prisma.syncStatus.update({
      where: { id: "singleton" },
      data: { isRunning: false },
    });
    console.error("Sync failed:", err);
    throw err;
  }
}
