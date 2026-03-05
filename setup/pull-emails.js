/**
 * Pull the latest emails via IMAP from an Exchange journal mailbox.
 *
 * Exchange journal format:
 *   Part 1 = text/plain summary (just headers — useless)
 *   Part 2 = message/rfc822 (the actual original email)
 *     Part 2.1 = text/html or text/plain (the real body)
 *     Part 2.2+ = attachments
 *
 * Run on the VM:  node setup/pull-emails.js
 * Then scp:       scp -r user@vm:/path/setup/emails ./setup/emails
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

// Check if this is a journal wrapper (part 1 = summary, part 2 = message/rfc822)
function isJournalMessage(struct) {
  if (!struct?.childNodes || struct.childNodes.length < 2) return false;
  return struct.childNodes.some((n) => n.type === "message/rfc822");
}

// Find the inner message's body parts from a journal structure
function findInnerBodyParts(struct) {
  for (const node of struct.childNodes || []) {
    if (node.type === "message/rfc822" && node.childNodes) {
      return findAllTextParts(node);
    }
  }
  return [];
}

// Find all text/plain and text/html parts recursively, using the "part" field from BODYSTRUCTURE
function findAllTextParts(struct) {
  const parts = [];
  if (!struct) return parts;

  if (Array.isArray(struct.childNodes)) {
    for (const child of struct.childNodes) {
      parts.push(...findAllTextParts(child));
    }
  }

  if (struct.part && struct.type === "text/plain") {
    parts.push({ type: "text", part: struct.part, size: struct.size || 0 });
  } else if (struct.part && struct.type === "text/html") {
    parts.push({ type: "html", part: struct.part, size: struct.size || 0 });
  }

  return parts;
}

// Find attachment names from BODYSTRUCTURE (skip journal summary part 1)
function findAttachments(struct, isJournal) {
  const attachments = [];
  if (!struct) return attachments;

  // For journal messages, only look inside the rfc822 part
  const searchNode = isJournal
    ? struct.childNodes?.find((n) => n.type === "message/rfc822")
    : struct;

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
    if (node.disposition === "attachment" || node.disposition === "inline") {
      const name = node.dispositionParameters?.filename
        || node.parameters?.name
        || null;
      // Skip inline images without useful names
      if (name && !name.startsWith("image00")) {
        attachments.push(name);
      }
    }
  }

  walk(searchNode);
  return attachments;
}

// Get the real envelope from a journal message (the inner rfc822's envelope)
function getInnerEnvelope(struct, outerEnvelope) {
  for (const node of struct.childNodes || []) {
    if (node.type === "message/rfc822" && node.envelope) {
      return node.envelope;
    }
  }
  return outerEnvelope;
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

    // First pass: get envelope + bodyStructure
    const messages = [];
    for await (const msg of client.fetch(range, {
      envelope: true,
      bodyStructure: true,
      uid: true,
    })) {
      messages.push(msg);
    }

    console.log(`Got ${messages.length} messages. Downloading bodies...`);

    for (const msg of messages) {
      try {
        const journal = isJournalMessage(msg.bodyStructure);
        const env = journal
          ? getInnerEnvelope(msg.bodyStructure, msg.envelope)
          : msg.envelope;

        // Find text parts — for journal msgs, look inside the rfc822 part
        const textParts = journal
          ? findInnerBodyParts(msg.bodyStructure)
          : findAllTextParts(msg.bodyStructure);

        const attachments = findAttachments(msg.bodyStructure, journal);

        let bodyText = "";

        // Prefer HTML for journal messages (Exchange usually only has HTML inside)
        // For regular messages, prefer plain text
        const plainPart = textParts.find((p) => p.type === "text" && p.size > 300);
        const htmlPart = textParts.find((p) => p.type === "html");

        const preferredPart = journal ? (htmlPart || plainPart) : (plainPart || htmlPart);

        if (preferredPart) {
          const { content } = await client.download(msg.seq.toString(), preferredPart.part, { uid: false });
          const raw = await streamToString(content);
          bodyText = preferredPart.type === "html" ? stripHtml(raw) : raw;
        }

        // Fallback: try all text parts
        if (!bodyText) {
          for (const part of textParts) {
            try {
              const { content } = await client.download(msg.seq.toString(), part.part, { uid: false });
              const raw = await streamToString(content);
              const text = part.type === "html" ? stripHtml(raw) : raw;
              if (text.length > bodyText.length) {
                bodyText = text;
              }
            } catch {
              // skip failed parts
            }
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
