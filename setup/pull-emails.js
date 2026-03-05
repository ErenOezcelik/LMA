/**
 * Pull the latest emails via IMAP and save as individual JSON files.
 *
 * Run on the VM:
 *   node setup/pull-emails.js
 *
 * Then scp from your local machine:
 *   scp -r user@vm-host:/path/to/KI-Tagesmappe/setup/emails ./setup/emails
 */

import "dotenv/config";
import { ImapFlow } from "imapflow";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "emails");
const MAX_EMAILS = 10;

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Recursively find text parts in a BODYSTRUCTURE
function findTextParts(struct, path = []) {
  const parts = [];
  if (!struct) return parts;

  if (Array.isArray(struct.childNodes)) {
    for (let i = 0; i < struct.childNodes.length; i++) {
      parts.push(...findTextParts(struct.childNodes[i], [...path, i + 1]));
    }
  } else {
    const partPath = path.length ? path.join(".") : "1";
    if (struct.type === "text/plain") {
      parts.push({ type: "text", part: partPath });
    } else if (struct.type === "text/html") {
      parts.push({ type: "html", part: partPath });
    }
  }
  return parts;
}

// Find attachment names from BODYSTRUCTURE
function findAttachments(struct) {
  const attachments = [];
  if (!struct) return attachments;

  if (Array.isArray(struct.childNodes)) {
    for (const child of struct.childNodes) {
      attachments.push(...findAttachments(child));
    }
  } else if (struct.disposition === "attachment" || (struct.type && !struct.type.startsWith("text/"))) {
    const name = struct.dispositionParameters?.filename
      || struct.parameters?.name
      || null;
    if (name) attachments.push(name);
  }
  return attachments;
}

async function main() {
  const host = process.env.IMAP_HOST || process.env.EWS_HOST?.replace("https://", "").replace("http://", "");
  const user = process.env.IMAP_USERNAME || process.env.EWS_USERNAME;
  const pass = process.env.IMAP_PASSWORD || process.env.EWS_PASSWORD;
  const port = parseInt(process.env.IMAP_PORT || "993", 10);
  const tls = process.env.IMAP_TLS !== "false";

  if (!host || !user || !pass) {
    console.error("Missing credentials. Set IMAP_HOST, IMAP_USERNAME, IMAP_PASSWORD in .env");
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

    // First pass: get envelope + bodyStructure for all messages
    const messages = [];
    for await (const msg of client.fetch(range, {
      envelope: true,
      bodyStructure: true,
      uid: true,
    })) {
      messages.push(msg);
    }

    console.log(`Got ${messages.length} message headers. Downloading bodies...`);

    // Second pass: download body content for each message
    for (const msg of messages) {
      try {
        const env = msg.envelope;
        const textParts = findTextParts(msg.bodyStructure);
        const attachments = findAttachments(msg.bodyStructure);

        let bodyText = "";

        // Try plain text first, then HTML
        const plainPart = textParts.find((p) => p.type === "text");
        const htmlPart = textParts.find((p) => p.type === "html");

        if (plainPart) {
          const { content } = await client.download(msg.seq.toString(), plainPart.part, { uid: false });
          bodyText = await streamToString(content);
        }

        if (!bodyText && htmlPart) {
          const { content } = await client.download(msg.seq.toString(), htmlPart.part, { uid: false });
          const html = await streamToString(content);
          bodyText = stripHtml(html);
        }

        // If still no body, try downloading the entire first part
        if (!bodyText) {
          try {
            const { content } = await client.download(msg.seq.toString(), "1", { uid: false });
            const raw = await streamToString(content);
            if (raw.includes("<") && raw.includes(">")) {
              bodyText = stripHtml(raw);
            } else {
              bodyText = raw;
            }
          } catch {
            bodyText = "";
          }
        }

        const email = {
          exchangeId: String(msg.uid),
          subject: env.subject || "(Kein Betreff)",
          sender: env.from?.[0]?.address || "",
          senderName: env.from?.[0]?.name || "",
          bodyText: bodyText.trim(),
          bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " ").trim(),
          receivedDate: env.date?.toISOString() || new Date().toISOString(),
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
        if (saved % 10 === 0) console.log(`  ${saved}/${messages.length}...`);
      } catch (err) {
        console.error(`  Failed to fetch email ${msg.uid}: ${err.message}`);
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
