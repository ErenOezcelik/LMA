import { useLoaderData, useSearchParams } from "react-router";
import { prisma } from "../lib/db.server.js";
import { fetchEmails } from "../lib/imap.server.js";
import EingangEmailCard from "../components/EingangEmailCard.jsx";

export function meta() {
  return [
    { title: "Eingang — KI-Tagesmappe" },
    { name: "description", content: "Alle eingehenden E-Mails" },
  ];
}

function defaultRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(6, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 0, 0);

  // Format as local datetime-local string (YYYY-MM-DDTHH:MM)
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  return { from: fmt(yesterday), to: fmt(todayEnd) };
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const defaults = defaultRange();

  const fromParam = url.searchParams.get("from") || defaults.from;
  const toParam = url.searchParams.get("to") || defaults.to;

  const fromDate = new Date(fromParam);
  const toDate = new Date(toParam);

  // Pull fresh emails from IMAP for this range
  try {
    const imapEmails = await fetchEmails(fromDate);

    // Filter to the requested range
    const inRange = imapEmails.filter((e) => {
      const d = new Date(e.receivedDate);
      return d >= fromDate && d <= toDate;
    });

    // Dedup and insert new ones
    if (inRange.length > 0) {
      const existingIds = new Set(
        (await prisma.email.findMany({
          where: { exchangeId: { in: inRange.map((e) => e.exchangeId) } },
          select: { exchangeId: true },
        })).map((e) => e.exchangeId)
      );

      const newEmails = inRange.filter((e) => !existingIds.has(e.exchangeId));

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
      }

      if (newEmails.length > 0) {
        console.log(`Eingang: ${newEmails.length} new emails imported from IMAP`);
      }
    }
  } catch (err) {
    console.error("IMAP fetch failed:", err.message);
  }

  // Now query the DB
  const emails = await prisma.email.findMany({
    where: {
      receivedDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { receivedDate: "desc" },
  });

  return {
    emails,
    from: fromParam,
    to: toParam,
    totalCount: emails.length,
  };
}

export default function Eingang() {
  const { emails, from, to, totalCount } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    setSearchParams({
      from: formData.get("from"),
      to: formData.get("to"),
    });
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Date/time range picker */}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 mb-8">
          <div>
            <label htmlFor="from" className="block text-xs font-medium text-stone-500 mb-1">
              Von
            </label>
            <input
              type="datetime-local"
              id="from"
              name="from"
              defaultValue={from}
              className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs font-medium text-stone-500 mb-1">
              Bis
            </label>
            <input
              type="datetime-local"
              id="to"
              name="to"
              defaultValue={to}
              className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
          >
            Anzeigen
          </button>
          <span className="text-sm text-stone-400 ml-auto">
            {totalCount} E-Mail{totalCount !== 1 ? "s" : ""}
          </span>
        </form>

        {/* Email list */}
        {emails.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg">Keine E-Mails in diesem Zeitraum</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => (
              <EingangEmailCard key={email.id} email={email} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
