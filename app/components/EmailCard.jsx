import { Link } from "react-router";

export default function EmailCard({ email }) {
  const importanceColor =
    email.importanceScore >= 0.8
      ? "bg-red-500"
      : email.importanceScore >= 0.5
        ? "bg-amber-400"
        : "bg-stone-300";

  const time = new Date(email.receivedDate).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      to={`/emails/${email.id}`}
      className="block bg-white rounded-xl border border-stone-200 shadow-sm p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${importanceColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-stone-900 truncate">
              {email.senderName || email.sender}
            </p>
            <span className="text-xs text-stone-400 shrink-0">{time}</span>
          </div>
          <p className="mt-0.5 text-sm text-stone-700 truncate">{email.subject}</p>
          <p className="mt-1 text-xs text-stone-400 line-clamp-2">{email.bodyPreview}</p>
        </div>
      </div>
      {email.correctedBucket && (
        <div className="mt-2 text-xs text-amber-600">
          Korrigiert
        </div>
      )}
    </Link>
  );
}
