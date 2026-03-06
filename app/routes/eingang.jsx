import { useLoaderData, useSearchParams, useFetcher, useNavigation } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { prisma } from "../lib/db.server.js";
import EingangEmailCard from "../components/EingangEmailCard.jsx";

const PAGE_SIZE = 50;

// Only select fields needed for the card — skip bodyText/bodyHtml
const EMAIL_SELECT = {
  id: true,
  exchangeId: true,
  subject: true,
  sender: true,
  senderName: true,
  bodyPreview: true,
  receivedDate: true,
  bucket: true,
  correctedBucket: true,
  importanceScore: true,
  isEscalated: true,
  rawResponse: true,
};

export function meta() {
  return [
    { title: "Eingang — KI-Tagesmappe" },
    { name: "description", content: "Alle eingehenden E-Mails" },
  ];
}

function roundTo5Min(d) {
  const ms = 5 * 60 * 1000;
  return new Date(Math.floor(d.getTime() / ms) * ms);
}

function defaultRange() {
  const now = new Date();
  const yesterday = roundTo5Min(new Date(now));
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(6, 0, 0, 0);

  const todayEnd = roundTo5Min(new Date(now));
  todayEnd.setHours(23, 55, 0, 0);

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
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const fromDate = new Date(fromParam);
  const toDate = new Date(toParam);

  const where = {
    receivedDate: { gte: fromDate, lte: toDate },
  };

  const [emails, totalCount, syncStatus] = await Promise.all([
    prisma.email.findMany({
      where,
      select: EMAIL_SELECT,
      orderBy: { receivedDate: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.email.count({ where }),
    prisma.syncStatus.findUnique({ where: { id: "singleton" } }),
  ]);

  return {
    emails,
    from: fromParam,
    to: toParam,
    totalCount,
    page,
    hasMore: page * PAGE_SIZE < totalCount,
    lastSync: syncStatus?.lastSyncAt?.toISOString() || null,
    isSyncRunning: syncStatus?.isRunning || false,
  };
}

export default function Eingang() {
  const data = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const syncFetcher = useFetcher();
  const moreFetcher = useFetcher();
  const navigation = useNavigation();

  const isNavigating = navigation.state === "loading";
  const isSyncing = syncFetcher.state !== "idle" || data.isSyncRunning;

  // Accumulate emails across pages
  const [allEmails, setAllEmails] = useState(data.emails);
  const [currentPage, setCurrentPage] = useState(data.page);
  const [hasMore, setHasMore] = useState(data.hasMore);

  // Reset when loader data changes (new date range)
  useEffect(() => {
    setAllEmails(data.emails);
    setCurrentPage(data.page);
    setHasMore(data.hasMore);
  }, [data.from, data.to, data.emails]);

  // Append when more pages load
  useEffect(() => {
    if (moreFetcher.data?.emails) {
      setAllEmails((prev) => [...prev, ...moreFetcher.data.emails]);
      setCurrentPage(moreFetcher.data.page);
      setHasMore(moreFetcher.data.hasMore);
    }
  }, [moreFetcher.data]);

  const isLoadingMore = moreFetcher.state !== "idle";

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    moreFetcher.load(`/?from=${data.from}&to=${data.to}&page=${nextPage}`);
  }, [isLoadingMore, hasMore, currentPage, data.from, data.to]);

  function handleShow(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    setSearchParams({
      from: formData.get("from"),
      to: formData.get("to"),
    });
  }

  function handleManualSync() {
    syncFetcher.submit(null, { method: "post", action: "/api/sync" });
  }

  const lastSyncText = data.lastSync
    ? new Date(data.lastSync).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "noch nie";

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Date/time range picker */}
        <form onSubmit={handleShow} className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label htmlFor="from" className="block text-xs font-medium text-stone-500 mb-1">
              Von
            </label>
            <input
              type="datetime-local"
              id="from"
              name="from"
              step="300"
              defaultValue={data.from}
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
              step="300"
              defaultValue={data.to}
              className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
          >
            {isNavigating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Laden...
              </span>
            ) : (
              "Anzeigen"
            )}
          </button>
          <span className="text-sm text-stone-400 ml-auto">
            {data.totalCount} E-Mail{data.totalCount !== 1 ? "s" : ""}
          </span>
        </form>

        {/* Sync status bar */}
        <div className="flex items-center gap-3 mb-8 text-xs text-stone-400">
          <span>Letzter Abruf: {lastSyncText}</span>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-md hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                Synchronisiere...
              </span>
            ) : (
              "Jetzt synchronisieren"
            )}
          </button>
        </div>

        {/* Content */}
        {allEmails.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg">Keine E-Mails in diesem Zeitraum</p>
            <p className="text-sm mt-2">E-Mails werden automatisch alle 5 Minuten synchronisiert</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {allEmails.map((email) => (
                <EingangEmailCard key={email.id} email={email} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
                      Laden...
                    </span>
                  ) : (
                    `Weitere laden (${data.totalCount - allEmails.length} verbleibend)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
