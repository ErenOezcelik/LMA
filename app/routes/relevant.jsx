import { useLoaderData } from "react-router";
import { prisma } from "../lib/db.server.js";
import BucketColumn from "../components/BucketColumn.jsx";

export function meta() {
  return [
    { title: "Relevant — KI-Tagesmappe" },
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
      receivedDate: { gte: startOfDay, lte: endOfDay },
      isEscalated: true,
    },
    orderBy: { receivedDate: "desc" },
  });

  const tradion = emails.filter((e) => (e.correctedBucket || e.bucket) === "tradion");
  const staubfilter = emails.filter((e) => (e.correctedBucket || e.bucket) === "staubfilter");
  const rest = emails.filter((e) => (e.correctedBucket || e.bucket) === "rest");

  return {
    date: startOfDay.toISOString(),
    totalCount: emails.length,
    tradion,
    staubfilter,
    rest,
  };
}

export default function Relevant() {
  const { date, totalCount, tradion, staubfilter, rest } = useLoaderData();

  const formatted = new Date(date).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 capitalize">
            {formatted}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {totalCount} relevante E-Mail{totalCount !== 1 ? "s" : ""}
          </p>
        </div>

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
