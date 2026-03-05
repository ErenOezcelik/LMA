import EmailCard from "./EmailCard.jsx";

const accentStyles = {
  blue: "border-l-blue-500",
  emerald: "border-l-emerald-500",
  stone: "border-l-stone-400",
};

const countStyles = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  stone: "bg-stone-100 text-stone-600",
};

export default function BucketColumn({ name, subtitle, emails, accentColor }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-stone-900">{name}</h2>
        <span className="text-xs text-stone-400">{subtitle}</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${countStyles[accentColor]}`}>
          {emails.length}
        </span>
      </div>
      <div className={`flex-1 space-y-2 border-l-2 ${accentStyles[accentColor]} pl-4`}>
        {emails.length === 0 ? (
          <p className="text-sm text-stone-400 py-8 text-center">Keine E-Mails</p>
        ) : (
          emails.map((email) => (
            <EmailCard key={email.id} email={email} />
          ))
        )}
      </div>
    </div>
  );
}
