import { prisma } from "../lib/db.server.js";
import { classifyEmail } from "../lib/classifier.server.js";

const ESCALATION_THRESHOLD = parseFloat(process.env.ESCALATION_THRESHOLD || "0.8");

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const emailId = formData.get("emailId");

  if (!emailId) {
    return Response.json({ error: "emailId ist erforderlich" }, { status: 400 });
  }

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  const result = await classifyEmail(email);

  await prisma.email.update({
    where: { id: emailId },
    data: {
      bucket: result.bucket,
      importanceScore: result.importanceScore,
      isEscalated: result.importanceScore >= ESCALATION_THRESHOLD,
      rawResponse: result.rawResponse,
      classifiedAt: new Date(),
    },
  });

  return Response.json({
    success: true,
    bucket: result.bucket,
    importanceScore: result.importanceScore,
    reasoning: result.reasoning,
  });
}
