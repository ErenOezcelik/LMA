import { AzureOpenAI } from "openai";
import { prisma } from "./db.server.js";

let client;

function getClient() {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  return client;
}

const BASE_PROMPT = `Du bist ein E-Mail-Klassifikator für ein deutsches Mittelstandsunternehmen, das Papierprodukte herstellt. Das Unternehmen hat zwei Geschäftsbereiche:

1. **Tradion** — Papierverpackungen (Wellpappe, Kartonagen, Verpackungslösungen, Faltschachteln)
2. **Staubfilter** — Staubsaugerbeutel und Filterbeutel (Haushalt, Staubsauger, Filtration)

Deine Aufgabe ist es, jede E-Mail in einen von drei Bereichen zu klassifizieren:
- "tradion" — E-Mails die den Verpackungsbereich betreffen
- "staubfilter" — E-Mails die den Staubsaugerbeutel-Bereich betreffen
- "rest" — Alle anderen E-Mails (intern, Werbung, IT, HR, allgemeine Anfragen etc.)

Zusätzlich bewerte die Wichtigkeit der E-Mail auf einer Skala von 0.0 bis 1.0:
- 0.8-1.0: Sehr wichtig — Geschäftsführung muss entscheiden (große Aufträge, Beschwerden, rechtliche Themen, Schlüsselkunden, strategische Entscheidungen)
- 0.5-0.7: Mittel wichtig — relevante Geschäftsvorgänge
- 0.0-0.4: Routine — Newsletter, automatische Benachrichtigungen, interne Rundmails

Antworte ausschließlich im JSON-Format:
{
  "bucket": "tradion" | "staubfilter" | "rest",
  "importanceScore": 0.0-1.0,
  "reasoning": "Kurze Begründung auf Deutsch"
}`;

async function buildSystemPrompt() {
  const rules = await prisma.classificationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const corrections = await prisma.correctionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let prompt = BASE_PROMPT;

  if (rules.length > 0) {
    prompt += "\n\n## Zusätzliche Regeln:\n";
    const grouped = { tradion: [], staubfilter: [], rest: [] };
    for (const rule of rules) {
      if (grouped[rule.bucket]) {
        grouped[rule.bucket].push(rule.ruleText);
      }
    }
    for (const [bucket, ruleTexts] of Object.entries(grouped)) {
      if (ruleTexts.length > 0) {
        prompt += `\n### ${bucket}:\n`;
        for (const text of ruleTexts) {
          prompt += `- ${text}\n`;
        }
      }
    }
  }

  if (corrections.length > 0) {
    prompt += "\n\n## Frühere Korrekturen (lerne daraus):\n";
    for (const c of corrections) {
      prompt += `- E-Mail von "${c.emailSender}" mit Betreff "${c.emailSubject}" wurde fälschlich als "${c.originalBucket}" klassifiziert. Korrekt ist: "${c.correctedBucket}"`;
      if (c.reason) {
        prompt += ` (Grund: ${c.reason})`;
      }
      prompt += "\n";
    }
  }

  return prompt;
}

export async function classifyEmail(email) {
  const openai = getClient();
  const systemPrompt = await buildSystemPrompt();

  const userMessage = `Betreff: ${email.subject}
Von: ${email.sender} (${email.senderName})
Datum: ${email.receivedDate.toLocaleDateString("de-DE")}
Inhalt:
${email.bodyText.substring(0, 4000)}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    const parsed = JSON.parse(content);

    const validBuckets = ["tradion", "staubfilter", "rest"];
    const bucket = validBuckets.includes(parsed.bucket) ? parsed.bucket : "rest";
    const importanceScore = Math.min(1, Math.max(0, parseFloat(parsed.importanceScore) || 0));

    return {
      bucket,
      importanceScore,
      reasoning: parsed.reasoning || "",
      rawResponse: content,
    };
  } catch (err) {
    console.error("Classification failed:", err.message);
    return {
      bucket: "rest",
      importanceScore: 0.5,
      reasoning: "Klassifikation fehlgeschlagen — Standardwert verwendet",
      rawResponse: null,
    };
  }
}
