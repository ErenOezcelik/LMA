import { useLoaderData, useFetcher, Link } from "react-router";
import { prisma } from "../lib/db.server.js";

export function meta() {
  return [{ title: "Einstellungen — KI-Tagesmappe" }];
}

export async function loader() {
  const rules = await prisma.classificationRule.findMany({
    orderBy: [{ bucket: "asc" }, { priority: "desc" }],
  });

  const corrections = await prisma.correctionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { rules, corrections };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "addRule") {
    await prisma.classificationRule.create({
      data: {
        bucket: formData.get("bucket"),
        ruleText: formData.get("ruleText"),
        priority: parseInt(formData.get("priority") || "0", 10),
      },
    });
  } else if (intent === "toggleRule") {
    const ruleId = formData.get("ruleId");
    const rule = await prisma.classificationRule.findUnique({ where: { id: ruleId } });
    if (rule) {
      await prisma.classificationRule.update({
        where: { id: ruleId },
        data: { isActive: !rule.isActive },
      });
    }
  } else if (intent === "deleteRule") {
    await prisma.classificationRule.delete({
      where: { id: formData.get("ruleId") },
    });
  }

  return { ok: true };
}

export default function Settings() {
  const { rules, corrections } = useLoaderData();
  const fetcher = useFetcher();

  const bucketLabels = {
    tradion: "Tradion",
    staubfilter: "Staubfilter",
    rest: "Rest",
  };

  const bucketColors = {
    tradion: "bg-blue-50 text-blue-700",
    staubfilter: "bg-emerald-50 text-emerald-700",
    rest: "bg-stone-100 text-stone-600",
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-semibold text-stone-900">Einstellungen</h1>
        <p className="mt-1 text-sm text-stone-500">Klassifikationsregeln und Korrekturen verwalten</p>

        {/* Add rule */}
        <div className="mt-8 bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-stone-700 mb-4">Neue Regel hinzufügen</h2>
          <fetcher.Form method="post" className="flex flex-col gap-3">
            <input type="hidden" name="intent" value="addRule" />
            <div className="flex gap-3">
              <select
                name="bucket"
                className="text-sm px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="tradion">Tradion</option>
                <option value="staubfilter">Staubfilter</option>
                <option value="rest">Rest</option>
              </select>
              <input
                type="number"
                name="priority"
                defaultValue="0"
                placeholder="Priorität"
                className="w-24 text-sm px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="text"
              name="ruleText"
              required
              placeholder="Regel beschreiben, z.B.: E-Mails von @mueller-gmbh.de gehören immer zu Tradion"
              className="text-sm px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="self-start px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
            >
              Hinzufügen
            </button>
          </fetcher.Form>
        </div>

        {/* Rules list */}
        <div className="mt-6 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-700">
              Aktive Regeln ({rules.filter((r) => r.isActive).length})
            </h2>
          </div>
          {rules.length === 0 ? (
            <div className="p-6 text-sm text-stone-400 text-center">
              Keine Regeln vorhanden
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {rules.map((rule) => (
                <li key={rule.id} className={`p-4 flex items-center gap-3 ${!rule.isActive ? "opacity-50" : ""}`}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bucketColors[rule.bucket]}`}>
                    {bucketLabels[rule.bucket]}
                  </span>
                  <span className="flex-1 text-sm text-stone-700">{rule.ruleText}</span>
                  <span className="text-xs text-stone-400">P{rule.priority}</span>
                  <fetcher.Form method="post" className="inline">
                    <input type="hidden" name="intent" value="toggleRule" />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <button
                      type="submit"
                      className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      {rule.isActive ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </fetcher.Form>
                  <fetcher.Form method="post" className="inline">
                    <input type="hidden" name="intent" value="deleteRule" />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Löschen
                    </button>
                  </fetcher.Form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Corrections log */}
        <div className="mt-6 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-700">
              Letzte Korrekturen ({corrections.length})
            </h2>
          </div>
          {corrections.length === 0 ? (
            <div className="p-6 text-sm text-stone-400 text-center">
              Keine Korrekturen vorhanden
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {corrections.map((c) => (
                <li key={c.id} className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bucketColors[c.originalBucket]}`}>
                      {bucketLabels[c.originalBucket]}
                    </span>
                    <svg className="w-3 h-3 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bucketColors[c.correctedBucket]}`}>
                      {bucketLabels[c.correctedBucket]}
                    </span>
                    <span className="text-stone-500 truncate flex-1">{c.emailSubject}</span>
                  </div>
                  <div className="mt-1 text-xs text-stone-400">
                    {c.emailSender} — {new Date(c.createdAt).toLocaleString("de-DE")}
                    {c.reason && <span className="ml-2 text-stone-500">({c.reason})</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
