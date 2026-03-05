import { useLoaderData, useFetcher, Link } from "react-router";
import { prisma } from "../lib/db.server.js";
import BucketSelector from "../components/BucketSelector.jsx";

export function meta({ data }) {
  return [{ title: data ? `${data.email.subject} — KI-Tagesmappe` : "E-Mail" }];
}

export async function loader({ params }) {
  const email = await prisma.email.findUnique({ where: { id: params.id } });
  if (!email) {
    throw new Response("E-Mail nicht gefunden", { status: 404 });
  }
  return { email };
}

export default function EmailDetail() {
  const { email } = useLoaderData();
  const fetcher = useFetcher();
  const currentBucket = email.correctedBucket || email.bucket;
  const isSaving = fetcher.state !== "idle";

  const bucketLabels = {
    tradion: "Tradion",
    staubfilter: "Staubfilter",
    rest: "Rest",
  };

  const bucketColors = {
    tradion: "bg-blue-50 text-blue-700 border-blue-200",
    staubfilter: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rest: "bg-stone-100 text-stone-600 border-stone-200",
  };

  const importanceColor =
    email.importanceScore >= 0.8
      ? "text-red-500"
      : email.importanceScore >= 0.5
        ? "text-amber-500"
        : "text-stone-400";

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Zurück
        </Link>

        {/* Email header */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-stone-900 leading-tight">
                  {email.subject}
                </h1>
                <div className="mt-2 flex items-center gap-3 text-sm text-stone-500">
                  <span className="font-medium text-stone-700">
                    {email.senderName || email.sender}
                  </span>
                  {email.senderName && (
                    <span className="text-stone-400">{email.sender}</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-stone-400">
                  {new Date(email.receivedDate).toLocaleString("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1 ${importanceColor}`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  <span className="text-xs font-medium">
                    {Math.round(email.importanceScore * 100)}%
                  </span>
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${bucketColors[currentBucket]}`}>
                  {bucketLabels[currentBucket]}
                </span>
              </div>
            </div>

            {email.isEscalated && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Für Geschäftsführung markiert
              </div>
            )}
          </div>

          {/* Email body */}
          <div className="p-6">
            {email.bodyHtml ? (
              <iframe
                srcDoc={email.bodyHtml}
                sandbox=""
                title="E-Mail Inhalt"
                className="w-full border-0"
                style={{ minHeight: "400px" }}
                onLoad={(e) => {
                  const doc = e.target.contentDocument;
                  if (doc) {
                    e.target.style.height = doc.documentElement.scrollHeight + "px";
                  }
                }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 leading-relaxed">
                {email.bodyText}
              </pre>
            )}
          </div>

          {/* Correction section */}
          <div className="p-6 border-t border-stone-100 bg-stone-50/50">
            <h3 className="text-sm font-medium text-stone-700 mb-3">Klassifikation ändern</h3>
            <fetcher.Form method="post" action="/api/correct">
              <input type="hidden" name="emailId" value={email.id} />
              <div className="flex items-end gap-3">
                <BucketSelector currentBucket={currentBucket} />
                <input
                  type="text"
                  name="reason"
                  placeholder="Grund (optional)"
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </fetcher.Form>
            {email.correctedBucket && (
              <p className="mt-2 text-xs text-stone-400">
                Korrigiert am{" "}
                {new Date(email.correctedAt).toLocaleString("de-DE")} — Original: {bucketLabels[email.bucket]}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
