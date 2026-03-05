/**
 * Import emails from setup/emails/*.json into the local SQLite database.
 * Used for local development — in production, emails come from IMAP sync.
 *
 * Usage: node setup/import-emails.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMAILS_DIR = join(__dirname, "emails");
const prisma = new PrismaClient();

async function main() {
  const files = readdirSync(EMAILS_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No email JSON files found in setup/emails/");
    process.exit(1);
  }

  console.log(`Found ${files.length} email files. Importing...`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = readFileSync(join(EMAILS_DIR, file), "utf-8");
    const email = JSON.parse(raw);

    // Skip if already exists
    const existing = await prisma.email.findUnique({
      where: { exchangeId: email.exchangeId },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.email.create({
      data: {
        exchangeId: email.exchangeId,
        subject: email.subject,
        sender: email.sender,
        senderName: email.senderName || "",
        bodyText: email.bodyText || "",
        bodyHtml: email.bodyHtml || "",
        bodyPreview: email.bodyPreview || "",
        receivedDate: new Date(email.receivedDate),
        bucket: "rest",         // default — will be classified later
        importanceScore: 0,
        isEscalated: false,
      },
    });

    imported++;
  }

  console.log(`Done. ${imported} imported, ${skipped} skipped (already exist).`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
