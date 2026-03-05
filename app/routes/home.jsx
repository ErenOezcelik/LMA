import { useLoaderData, Link, useFetcher } from "react-router";
import { prisma } from "../lib/db.server.js";
import DayHeader from "../components/DayHeader.jsx";
import EscalationBar from "../components/EscalationBar.jsx";
import BucketColumn from "../components/BucketColumn.jsx";

export function meta() {
  return [
    { title: "KI-Tagesmappe" },
    { name: "description", content: "E-Mail Klassifikation für die Geschäftsführung" },
  ];
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");

  const today = dateParam ? new Date(dateParam) : new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const emails = await prisma.email.findMany({
    where: {
      receivedDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { receivedDate: "desc" },
  });

  const escalated = emails.filter((e) => e.isEscalated);
  const tradion = emails.filter((e) => (e.correctedBucket || e.bucket) === "tradion");
  const staubfilter = emails.filter((e) => (e.correctedBucket || e.bucket) === "staubfilter");
  const rest = emails.filter((e) => (e.correctedBucket || e.bucket) === "rest");

  const syncStatus = await prisma.syncStatus.findUnique({ where: { id: "singleton" } });

  return {
    date: startOfDay.toISOString(),
    totalCount: emails.length,
    escalated,
    tradion,
    staubfilter,
    rest,
    syncStatus,
  };
}

export default function Home() {
  const { date, totalCount, escalated, tradion, staubfilter, rest, syncStatus } =
    useLoaderData();
  const syncFetcher = useFetcher();
  const isSyncing = syncFetcher.state !== "idle";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <DayHeader
          date={date}
          totalCount={totalCount}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onSync={() => syncFetcher.submit({}, { method: "post", action: "/api/sync" })}
        />

        {escalated.length > 0 && (
          <EscalationBar emails={escalated} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <BucketColumn
            name="Tradion"
            subtitle="Verpackungen"
            emails={tradion}
            accentColor="blue"
          />
          <BucketColumn
            name="Staubfilter"
            subtitle="Staubsaugerbeutel"
            emails={staubfilter}
            accentColor="emerald"
          />
          <BucketColumn
            name="Rest"
            subtitle="Sonstige"
            emails={rest}
            accentColor="stone"
          />
        </div>
      </div>
    </div>
  );
}
