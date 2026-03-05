import { Link, useFetcher } from "react-router";

export default function EingangEmailCard({ email }) {
  const fetcher = useFetcher();

  const activeBucket = fetcher.formData?.get("bucket") || email.correctedBucket || email.bucket;
  const isRelevant = fetcher.formData?.has("relevance")
    ? fetcher.formData.get("relevance") === "true"
    : email.isEscalated;

  const time = new Date(email.receivedDate).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = new Date(email.receivedDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });

  function submit(data) {
    fetcher.submit(data, { method: "post", action: "/api/correct" });
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <Link to={`/emails/${email.id}`} className="block hover:opacity-80 transition-opacity">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-stone-900 truncate">
                {email.senderName || email.sender}
              </p>
              <span className="text-xs text-stone-400 shrink-0">{date} {time}</span>
            </div>
            <p className="mt-0.5 text-sm text-stone-700 truncate">{email.subject}</p>
            <p className="mt-1 text-xs text-stone-400 line-clamp-2">{email.bodyPreview}</p>
          </div>
        </div>
      </Link>

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Relevance */}
        <button
          onClick={() => submit({ emailId: email.id, relevance: "true" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isRelevant
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-white text-stone-500 border-stone-200 hover:border-amber-300 hover:text-amber-600"
          }`}
        >
          Relevant
        </button>
        <button
          onClick={() => submit({ emailId: email.id, relevance: "false" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !isRelevant
              ? "bg-stone-200 text-stone-700 border-stone-200"
              : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
          }`}
        >
          Nicht relevant
        </button>

        <span className="w-px h-5 bg-stone-200 mx-1" />

        {/* Buckets */}
        <button
          onClick={() => submit({ emailId: email.id, bucket: "tradion" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            activeBucket === "tradion"
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white text-stone-500 border-stone-200 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          Tradion
        </button>
        <button
          onClick={() => submit({ emailId: email.id, bucket: "staubfilter" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            activeBucket === "staubfilter"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-stone-500 border-stone-200 hover:border-emerald-300 hover:text-emerald-600"
          }`}
        >
          Staubfilter
        </button>
        <button
          onClick={() => submit({ emailId: email.id, bucket: "rest" })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            activeBucket === "rest"
              ? "bg-stone-500 text-white border-stone-500"
              : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
          }`}
        >
          Rest
        </button>
      </div>
    </div>
  );
}
