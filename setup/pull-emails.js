/**
 * Pull the latest 100 emails from Exchange via EWS and save as individual JSON files.
 *
 * Run on the VM:
 *   node setup/pull-emails.js
 *
 * Then scp from your local machine:
 *   scp -r user@vm-host:/path/to/KI-Tagesmappe/setup/emails ./setup/emails
 *
 * Or use the companion script:
 *   ./setup/fetch-emails.sh user@vm-host /path/to/KI-Tagesmappe
 */

import "dotenv/config";
import EWS from "node-ews";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "emails");
const MAX_EMAILS = 100;

async function main() {
  const ews = new EWS({
    username: process.env.EWS_USERNAME,
    password: process.env.EWS_PASSWORD,
    host: process.env.EWS_HOST,
    auth: process.env.EWS_AUTH || "ntlm",
  });

  console.log(`Connecting to ${process.env.EWS_HOST}...`);

  // Find latest emails
  const findResult = await ews.run("FindItem", {
    attributes: { Traversal: "Shallow" },
    ItemShape: { BaseShape: "IdOnly" },
    IndexedPageItemView: {
      attributes: {
        MaxEntriesReturned: String(MAX_EMAILS),
        Offset: "0",
        BasePoint: "Beginning",
      },
    },
    SortOrder: {
      FieldOrder: {
        attributes: { Order: "Descending" },
        FieldURI: { attributes: { FieldURI: "item:DateTimeReceived" } },
      },
    },
    ParentFolderIds: {
      DistinguishedFolderId: { attributes: { Id: "inbox" } },
    },
  });

  const items =
    findResult?.ResponseMessages?.FindItemResponseMessage?.RootFolder?.Items
      ?.Message || [];
  const messages = Array.isArray(items) ? items : [items];

  if (!messages.length || !messages[0]?.ItemId) {
    console.log("No emails found.");
    return;
  }

  console.log(`Found ${messages.length} emails. Fetching details...`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let saved = 0;

  for (const msg of messages) {
    try {
      const result = await ews.run("GetItem", {
        ItemShape: {
          BaseShape: "Default",
          BodyType: "Text",
          AdditionalProperties: {
            FieldURI: [
              { attributes: { FieldURI: "item:Body" } },
              { attributes: { FieldURI: "item:DateTimeReceived" } },
              { attributes: { FieldURI: "message:From" } },
            ],
          },
        },
        ItemIds: {
          ItemId: {
            attributes: {
              Id: msg.ItemId.attributes.Id,
              ChangeKey: msg.ItemId.attributes.ChangeKey,
            },
          },
        },
      });

      const detail =
        result?.ResponseMessages?.GetItemResponseMessage?.Items?.Message;
      if (!detail) continue;

      const bodyText =
        typeof detail.Body === "string"
          ? detail.Body
          : detail.Body?.$value || detail.Body?._ || "";

      const email = {
        exchangeId: msg.ItemId.attributes.Id,
        subject: detail.Subject || "(Kein Betreff)",
        sender: detail.From?.Mailbox?.EmailAddress || "",
        senderName: detail.From?.Mailbox?.Name || "",
        bodyText,
        bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " ").trim(),
        receivedDate: detail.DateTimeReceived || new Date().toISOString(),
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
      console.error(`  Failed to fetch email: ${err.message}`);
    }
  }

  console.log(`\nDone. ${saved} emails saved to ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
