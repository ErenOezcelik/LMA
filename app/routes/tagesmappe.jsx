import { useLoaderData } from "react-router";
import { useState, useRef, useCallback } from "react";
import { prisma } from "../lib/db.server.js";

export function meta() {
  return [
    { title: "Tagesmappe — KI-Tagesmappe" },
    { name: "description", content: "Tagesmappe als PDF erstellen" },
  ];
}

const EMAIL_SELECT = {
  id: true,
  subject: true,
  sender: true,
  senderName: true,
  bodyPreview: true,
  bodyHtml: true,
  bodyText: true,
  receivedDate: true,
  bucket: true,
  correctedBucket: true,
  importanceScore: true,
};

const BUCKETS = [
  { key: "tradion", label: "Tradion", subtitle: "Verpackungen", color: "blue" },
  { key: "staubfilter", label: "Staubfilter", subtitle: "Staubsaugerbeutel", color: "emerald" },
  { key: "rest", label: "Rest", subtitle: "Sonstige", color: "stone" },
];

const BUCKET_COLORS = {
  tradion: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  staubfilter: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  rest: { bg: "bg-stone-50", border: "border-stone-200", text: "text-stone-600", badge: "bg-stone-100 text-stone-600" },
};

function getBucket(email) {
  return email.correctedBucket || email.bucket;
}

function generateHTML(bucketGroups) {
  const date = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalCount = Object.values(bucketGroups).flat().length;
  let counter = 0;

  const sections = BUCKETS.map(({ key, label, subtitle }) => {
    const emails = bucketGroups[key] || [];
    if (emails.length === 0) return "";

    const emailBlocks = emails.map((email) => {
      counter++;
      const time = new Date(email.receivedDate).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const body = email.bodyHtml || `<pre style="white-space:pre-wrap;font-family:sans-serif;">${email.bodyText}</pre>`;

      return `
        <div style="page-break-inside:avoid;margin-bottom:24px;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
          <div style="padding:12px 16px;background:#fafaf9;border-bottom:1px solid #e7e5e4;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <strong style="font-size:14px;color:#1c1917;">${counter}. ${email.subject}</strong>
              <span style="font-size:12px;color:#a8a29e;">${time}</span>
            </div>
            <div style="font-size:13px;color:#57534e;margin-top:4px;">
              Von: ${email.senderName || email.sender} ${email.senderName ? `&lt;${email.sender}&gt;` : ""}
            </div>
          </div>
          <div style="padding:12px 16px;font-size:13px;line-height:1.6;color:#292524;">
            ${body}
          </div>
        </div>`;
    }).join("\n");

    return `
      <div style="margin-bottom:40px;">
        <h2 style="font-size:16px;font-weight:600;color:#1c1917;margin:0 0 4px;padding-bottom:8px;border-bottom:2px solid #e7e5e4;">
          ${label} <span style="font-weight:400;color:#78716c;font-size:13px;">— ${subtitle} (${emails.length})</span>
        </h2>
        ${emailBlocks}
      </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Tagesmappe — ${date}</title>
  <style>
    @media print { body { margin: 0; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #1c1917; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
    .subtitle { font-size: 14px; color: #78716c; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>Tagesmappe</h1>
  <p class="subtitle">${date} — ${totalCount} relevante E-Mail${totalCount !== 1 ? "s" : ""}</p>
  ${sections}
</body>
</html>`;
}

export async function loader() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const emails = await prisma.email.findMany({
    where: {
      isEscalated: true,
      receivedDate: { gte: today, lte: endOfDay },
    },
    select: EMAIL_SELECT,
    orderBy: { receivedDate: "desc" },
  });

  const grouped = { tradion: [], staubfilter: [], rest: [] };
  for (const email of emails) {
    const b = getBucket(email);
    if (grouped[b]) grouped[b].push(email);
    else grouped.rest.push(email);
  }

  return { grouped, totalCount: emails.length };
}

export default function Tagesmappe() {
  const { grouped: initialGrouped, totalCount } = useLoaderData();
  const [grouped, setGrouped] = useState(initialGrouped);
  const dragState = useRef({ bucket: null, index: null });
  const dragOverState = useRef({ bucket: null, index: null });

  const handleDragStart = useCallback((bucket, index) => {
    dragState.current = { bucket, index };
  }, []);

  const handleDragEnter = useCallback((bucket, index) => {
    dragOverState.current = { bucket, index };
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragState.current;
    const to = dragOverState.current;
    if (!from.bucket || !to.bucket) return;

    // Only reorder within same bucket
    if (from.bucket === to.bucket && from.index !== to.index) {
      setGrouped((prev) => {
        const items = [...prev[from.bucket]];
        const [dragged] = items.splice(from.index, 1);
        items.splice(to.index, 0, dragged);
        return { ...prev, [from.bucket]: items };
      });
    }

    dragState.current = { bucket: null, index: null };
    dragOverState.current = { bucket: null, index: null };
  }, []);

  const moveItem = useCallback((bucket, fromIndex, direction) => {
    setGrouped((prev) => {
      const items = [...prev[bucket]];
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= items.length) return prev;
      [items[fromIndex], items[toIndex]] = [items[toIndex], items[fromIndex]];
      return { ...prev, [bucket]: items };
    });
  }, []);

  function handleDownload() {
    const html = generateHTML(grouped);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `Tagesmappe_${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const html = generateHTML(grouped);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Tagesmappe</h1>
            <p className="text-sm text-stone-500 mt-1">
              {totalCount} relevante E-Mail{totalCount !== 1 ? "s" : ""} — Reihenfolge per Drag & Drop ändern
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={totalCount === 0}
              className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Drucken / PDF
            </button>
            <button
              onClick={handleDownload}
              disabled={totalCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              HTML herunterladen
            </button>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg">Keine relevanten E-Mails für heute</p>
            <p className="text-sm mt-2">E-Mails im Eingang als relevant markieren</p>
          </div>
        ) : (
          <div className="space-y-8">
            {BUCKETS.map(({ key, label, subtitle, color }) => {
              const emails = grouped[key] || [];
              if (emails.length === 0) return null;
              const colors = BUCKET_COLORS[key];

              return (
                <div key={key}>
                  {/* Bucket header */}
                  <div className={`flex items-baseline gap-2 pb-3 mb-3 border-b-2 ${colors.border}`}>
                    <h2 className={`text-base font-semibold ${colors.text}`}>{label}</h2>
                    <span className="text-xs text-stone-400">{subtitle} ({emails.length})</span>
                  </div>

                  {/* Emails in bucket */}
                  <div className="space-y-2">
                    {emails.map((email, index) => (
                      <div
                        key={email.id}
                        draggable
                        onDragStart={() => handleDragStart(key, index)}
                        onDragEnter={() => handleDragEnter(key, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 shadow-sm p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
                      >
                        {/* Drag handle */}
                        <div className="flex items-center gap-2 shrink-0">
                          <svg className="w-4 h-4 text-stone-300" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="4" cy="3" r="1.5" />
                            <circle cx="12" cy="3" r="1.5" />
                            <circle cx="4" cy="8" r="1.5" />
                            <circle cx="12" cy="8" r="1.5" />
                            <circle cx="4" cy="13" r="1.5" />
                            <circle cx="12" cy="13" r="1.5" />
                          </svg>
                          <span className="text-xs font-medium text-stone-400 w-5 text-center">{index + 1}</span>
                        </div>

                        {/* Email info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{email.subject}</p>
                          <p className="text-xs text-stone-500 truncate mt-0.5">
                            {email.senderName || email.sender} — {new Date(email.receivedDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>

                        {/* Up/Down */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveItem(key, index, -1)}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-stone-100 disabled:opacity-20 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveItem(key, index, 1)}
                            disabled={index === emails.length - 1}
                            className="p-1 rounded hover:bg-stone-100 disabled:opacity-20 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preview */}
        {totalCount > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-medium text-stone-700 mb-4">Vorschau</h2>
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <iframe
                srcDoc={generateHTML(grouped)}
                title="Tagesmappe Vorschau"
                sandbox=""
                className="w-full border-0"
                style={{ minHeight: "600px" }}
                onLoad={(e) => {
                  const doc = e.target.contentDocument;
                  if (doc) {
                    e.target.style.height = Math.max(600, doc.documentElement.scrollHeight) + "px";
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
