import { ImapFlow } from "imapflow";

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

function isJournalMessage(struct) {
  if (!struct?.childNodes || struct.childNodes.length < 2) return false;
  return struct.childNodes.some((n) => n.type === "message/rfc822");
}

function findInnerBodyParts(struct) {
  for (const node of struct.childNodes || []) {
    if (node.type === "message/rfc822" && node.childNodes) {
      return findAllTextParts(node);
    }
  }
  return [];
}

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

function getInnerEnvelope(struct, outerEnvelope) {
  for (const node of struct.childNodes || []) {
    if (node.type === "message/rfc822" && node.envelope) {
      return node.envelope;
    }
  }
  return outerEnvelope;
}

function getImapConfig() {
  const host = process.env.IMAP_HOST || process.env.EWS_HOST?.replace("https://", "").replace("http://", "");
  const user = process.env.IMAP_USERNAME || process.env.EWS_USERNAME;
  const pass = process.env.IMAP_PASSWORD || process.env.EWS_PASSWORD;
  const port = parseInt(process.env.IMAP_PORT || "993", 10);
  const tls = process.env.IMAP_TLS !== "false";

  if (!host || !user || !pass) {
    throw new Error("Missing IMAP credentials. Set IMAP_HOST, IMAP_USERNAME, IMAP_PASSWORD in .env");
  }

  return { host, port, tls, user, pass };
}

/**
 * Fetch emails from IMAP since a given date.
 * Handles Exchange journal mailbox format automatically.
 */
export async function fetchEmails(since = null) {
  const config = getImapConfig();

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const totalMessages = client.mailbox.exists;
    if (totalMessages === 0) return [];

    // Search for messages since the given date, or last 24h
    let searchCriteria;
    if (since) {
      searchCriteria = { since };
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      searchCriteria = { since: yesterday };
    }

    let uids;
    try {
      uids = await client.search(searchCriteria);
    } catch {
      // Fallback: fetch last 200 messages if SEARCH fails
      const startSeq = Math.max(1, totalMessages - 200 + 1);
      uids = [];
      for await (const msg of client.fetch(`${startSeq}:*`, { uid: true })) {
        uids.push(msg.uid);
      }
    }

    if (!uids || uids.length === 0) return [];

    console.log(`IMAP: Found ${uids.length} messages to process`);

    // Fetch envelope + bodyStructure
    const messages = [];
    for await (const msg of client.fetch(uids, {
      envelope: true,
      bodyStructure: true,
      uid: true,
    }, { uid: true })) {
      messages.push(msg);
    }

    const emails = [];

    for (const msg of messages) {
      try {
        const journal = isJournalMessage(msg.bodyStructure);
        const env = journal
          ? getInnerEnvelope(msg.bodyStructure, msg.envelope)
          : msg.envelope;

        const textParts = journal
          ? findInnerBodyParts(msg.bodyStructure)
          : findAllTextParts(msg.bodyStructure);

        let bodyText = "";
        let bodyHtml = "";

        const plainPart = textParts.find((p) => p.type === "text" && p.size > 300);
        const htmlPart = textParts.find((p) => p.type === "html");

        if (htmlPart) {
          const { content } = await client.download(String(msg.uid), htmlPart.part, { uid: true });
          bodyHtml = await streamToString(content);
          bodyText = stripHtml(bodyHtml);
        }

        if (!bodyText && plainPart) {
          const { content } = await client.download(String(msg.uid), plainPart.part, { uid: true });
          bodyText = await streamToString(content);
        }

        if (!bodyText) {
          for (const part of textParts) {
            try {
              const { content } = await client.download(String(msg.uid), part.part, { uid: true });
              const raw = await streamToString(content);
              if (part.type === "html" && !bodyHtml) bodyHtml = raw;
              const text = part.type === "html" ? stripHtml(raw) : raw;
              if (text.length > bodyText.length) bodyText = text;
            } catch {
              // skip failed parts
            }
          }
        }

        emails.push({
          exchangeId: String(msg.uid),
          subject: env.subject || "(Kein Betreff)",
          sender: env.from?.[0]?.address || "",
          senderName: env.from?.[0]?.name || "",
          bodyText: bodyText.trim(),
          bodyHtml,
          bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " ").trim(),
          receivedDate: env.date || new Date(),
        });
      } catch (err) {
        console.error(`IMAP: Failed to process message ${msg.uid}: ${err.message}`);
      }
    }

    console.log(`IMAP: Successfully fetched ${emails.length} emails`);
    return emails;
  } finally {
    lock.release();
    await client.logout();
  }
}
