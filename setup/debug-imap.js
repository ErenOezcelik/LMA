/**
 * Debug script — dumps raw IMAP data for the latest email to understand
 * what Exchange is actually returning.
 */

import "dotenv/config";
import { ImapFlow } from "imapflow";

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const host = process.env.IMAP_HOST || process.env.EWS_HOST?.replace("https://", "").replace("http://", "");
  const user = process.env.IMAP_USERNAME || process.env.EWS_USERNAME;
  const pass = process.env.IMAP_PASSWORD || process.env.EWS_PASSWORD;
  const port = parseInt(process.env.IMAP_PORT || "993", 10);

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  console.log("Connected.\n");

  const lock = await client.getMailboxLock("INBOX");

  try {
    const total = client.mailbox.exists;
    console.log(`Total messages: ${total}`);
    console.log(`Fetching message #${total} (latest)...\n`);

    // Fetch the latest message with everything
    for await (const msg of client.fetch(`${total}:${total}`, {
      envelope: true,
      bodyStructure: true,
      source: true,
      uid: true,
    })) {
      console.log("=== ENVELOPE ===");
      console.log(JSON.stringify(msg.envelope, null, 2));

      console.log("\n=== BODYSTRUCTURE ===");
      console.log(JSON.stringify(msg.bodyStructure, null, 2));

      console.log("\n=== SOURCE (first 2000 chars) ===");
      const source = msg.source?.toString("utf-8") || "(no source)";
      console.log(source.substring(0, 2000));

      console.log("\n=== TRYING BODY PART DOWNLOADS ===");

      // Try downloading various part numbers
      for (const partId of ["1", "1.1", "1.2", "2", "TEXT"]) {
        try {
          const { content, meta } = await client.download(String(total), partId, { uid: false });
          const text = await streamToString(content);
          console.log(`\n--- Part "${partId}" (${text.length} bytes) ---`);
          console.log(text.substring(0, 500));
        } catch (err) {
          console.log(`\n--- Part "${partId}" --- ERROR: ${err.message}`);
        }
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
