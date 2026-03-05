import { Link } from "react-router";

export default function EscalationBar({ emails }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="text-sm font-semibold text-amber-700">
          Für Geschäftsführung ({emails.length})
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {emails.map((email) => (
          <Link
            key={email.id}
            to={`/emails/${email.id}`}
            className="flex-shrink-0 w-72 bg-white border-l-3 border-amber-400 rounded-xl border border-stone-200 shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-stone-900 truncate">{email.subject}</p>
            <p className="mt-1 text-xs text-stone-500 truncate">
              {email.senderName || email.sender}
            </p>
            <p className="mt-1 text-xs text-stone-400 line-clamp-2">{email.bodyPreview}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
