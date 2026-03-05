import { useLoaderData, Link, useFetcher } from "react-router";
import { prisma } from "../lib/db.server.js";
import DayHeader from "../components/DayHeader.jsx";
import BucketColumn from "../components/BucketColumn.jsx";

export function meta() {
  return [
    { title: "Tagesmappe — KI-Tagesmappe" },
    { name: "description", content: "Relevante E-Mails nach Bereich sortiert" },
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
      isEscalated: true,
    },
    orderBy: { receivedDate: "desc" },
  });

  const tradion = emails.filter((e) => (e.correctedBucket || e.bucket) === "tradion");
  const staubfilter = emails.filter((e) => (e.correctedBucket || e.bucket) === "staubfilter");
  const rest = emails.filter((e) => (e.correctedBucket || e.bucket) === "rest");

  const syncStatus = await prisma.syncStatus.findUnique({ where: { id: "singleton" } });

  return {
    date: startOfDay.toISOString(),
    totalCount: emails.length,
    tradion,
    staubfilter,
    rest,
    syncStatus,
  };
}

export default function Home() {
  const { date, totalCount, tradion, staubfilter, rest, syncStatus } =
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

        {totalCount === 0 && (
          <div className="text-center py-16 text-stone-400 mt-8">
            <p className="text-lg">Keine relevanten E-Mails für diesen Tag</p>
            <p className="text-sm mt-1">E-Mails im Eingang als relevant markieren</p>
          </div>
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
