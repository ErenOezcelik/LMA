/**
 * Pull the latest 100 emails via IMAP and save as individual JSON files.
 *
 * Run on the VM:
 *   node setup/pull-emails.js
 *
 * Then scp from your local machine:
 *   scp -r user@vm-host:/path/to/KI-Tagesmappe/setup/emails ./setup/emails
 */

import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "emails");
const MAX_EMAILS = 100;

async function main() {
  const host = process.env.IMAP_HOST || process.env.EWS_HOST?.replace("https://", "").replace("http://", "");
  const user = process.env.IMAP_USERNAME || process.env.EWS_USERNAME;
  const pass = process.env.IMAP_PASSWORD || process.env.EWS_PASSWORD;
  const port = parseInt(process.env.IMAP_PORT || "993", 10);
  const tls = process.env.IMAP_TLS !== "false";

  if (!host || !user || !pass) {
    console.error("Missing credentials. Set IMAP_HOST, IMAP_USERNAME, IMAP_PASSWORD in .env");
    console.error("Or it will fall back to EWS_HOST/EWS_USERNAME/EWS_PASSWORD");
    process.exit(1);
  }

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  const client = new ImapFlow({
    host,
    port,
    secure: tls,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  console.log("Connected.");

  const lock = await client.getMailboxLock("INBOX");

  try {
    const totalMessages = client.mailbox.exists;
    console.log(`Inbox has ${totalMessages} messages. Fetching latest ${MAX_EMAILS}...`);

    const startSeq = Math.max(1, totalMessages - MAX_EMAILS + 1);
    const range = `${startSeq}:*`;

    mkdirSync(OUTPUT_DIR, { recursive: true });

    let saved = 0;

    for await (const msg of client.fetch(range, {
      source: true,
      envelope: true,
      uid: true,
    })) {
      try {
        const parsed = await simpleParser(msg.source);

        // Prefer plain text, fall back to stripped HTML
        let bodyText = parsed.text || "";
        if (!bodyText && parsed.html) {
          bodyText = parsed.html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#\d+;/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }

        const attachments = (parsed.attachments || []).map((a) => a.filename || "unnamed");

        const email = {
          exchangeId: String(msg.uid),
          subject: parsed.subject || "(Kein Betreff)",
          sender: parsed.from?.value?.[0]?.address || "",
          senderName: parsed.from?.value?.[0]?.name || "",
          bodyText,
          bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " ").trim(),
          receivedDate: parsed.date?.toISOString() || new Date().toISOString(),
          attachments,
        };

        const filename = `${String(saved + 1).padStart(3, "0")}_${email.subject
          .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "")
          .substring(0, 60)
          .trim()}.json`;

        writeFileSync(
          join(OUTPUT_DIR, filename),
          JSON.stringify(email, null, 2),
          "utf-8"
        );

        saved++;
        if (saved % 10 === 0) console.log(`  ${saved}...`);
      } catch (err) {
        console.error(`  Failed to parse email: ${err.message}`);
      }
    }

    console.log(`\nDone. ${saved} emails saved to ${OUTPUT_DIR}/`);
  } finally {
    lock.release();
    await client.logout();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
