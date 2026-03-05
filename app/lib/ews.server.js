import EWS from "node-ews";

function getEwsClient() {
  const ewsConfig = {
    username: process.env.EWS_USERNAME,
    password: process.env.EWS_PASSWORD,
    host: process.env.EWS_HOST,
    auth: process.env.EWS_AUTH || "ntlm",
  };

  return new EWS(ewsConfig);
}

/**
 * Fetch emails from Exchange inbox for a given date range.
 * Returns an array of { exchangeId, subject, sender, senderName, bodyText, receivedDate }
 */
export async function fetchEmails(since = null) {
  const ews = getEwsClient();

  const startDate = since
    ? since.toISOString()
    : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const ewsFunction = "FindItem";
  const ewsArgs = {
    attributes: {
      Traversal: "Shallow",
    },
    ItemShape: {
      BaseShape: "Default",
    },
    IndexedPageItemView: {
      attributes: {
        MaxEntriesReturned: "1000",
        Offset: "0",
        BasePoint: "Beginning",
      },
    },
    Restriction: {
      IsGreaterThanOrEqualTo: {
        FieldURI: { attributes: { FieldURI: "item:DateTimeReceived" } },
        FieldURIOrConstant: {
          Constant: { attributes: { Value: startDate } },
        },
      },
    },
    ParentFolderIds: {
      DistinguishedFolderId: {
        attributes: { Id: "inbox" },
      },
    },
  };

  const findResult = await ews.run(ewsFunction, ewsArgs);

  const items =
    findResult?.ResponseMessages?.FindItemResponseMessage?.RootFolder?.Items
      ?.Message || [];

  const messages = Array.isArray(items) ? items : [items];

  if (!messages.length || !messages[0]?.ItemId) {
    return [];
  }

  // Fetch full details for each message
  const emails = [];

  for (const msg of messages) {
    try {
      const detail = await getEmailDetail(ews, msg.ItemId.attributes.Id, msg.ItemId.attributes.ChangeKey);
      if (detail) {
        emails.push(detail);
      }
    } catch (err) {
      console.error(`Failed to fetch email detail: ${err.message}`);
    }
  }

  return emails;
}

async function getEmailDetail(ews, itemId, changeKey) {
  const ewsFunction = "GetItem";
  const ewsArgs = {
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
          Id: itemId,
          ChangeKey: changeKey,
        },
      },
    },
  };

  const result = await ews.run(ewsFunction, ewsArgs);
  const message =
    result?.ResponseMessages?.GetItemResponseMessage?.Items?.Message;

  if (!message) return null;

  const bodyText =
    typeof message.Body === "string"
      ? message.Body
      : message.Body?.$value || message.Body?._ || "";

  const sender =
    message.From?.Mailbox?.EmailAddress || "";
  const senderName =
    message.From?.Mailbox?.Name || "";

  return {
    exchangeId: itemId,
    subject: message.Subject || "(Kein Betreff)",
    sender,
    senderName,
    bodyText,
    bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " ").trim(),
    receivedDate: new Date(message.DateTimeReceived || Date.now()),
  };
}
