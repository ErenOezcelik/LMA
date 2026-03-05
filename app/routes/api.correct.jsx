import { prisma } from "../lib/db.server.js";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const emailId = formData.get("emailId");
  const newBucket = formData.get("bucket");
  const relevance = formData.get("relevance");
  const reason = formData.get("reason") || null;

  if (!emailId) {
    return Response.json({ error: "emailId ist erforderlich" }, { status: 400 });
  }

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Handle relevance toggle
  if (relevance !== null && relevance !== undefined) {
    const isEscalated = relevance === "true";
    await prisma.email.update({
      where: { id: emailId },
      data: { isEscalated },
    });
    return Response.json({ success: true });
  }

  // Handle bucket correction
  if (!newBucket) {
    return Response.json({ error: "bucket oder relevance ist erforderlich" }, { status: 400 });
  }

  const validBuckets = ["tradion", "staubfilter", "rest"];
  if (!validBuckets.includes(newBucket)) {
    return Response.json({ error: "Ungültiger Bucket" }, { status: 400 });
  }

  const originalBucket = email.correctedBucket || email.bucket;

  if (originalBucket === newBucket) {
    return Response.json({ message: "Keine Änderung" });
  }

  await prisma.$transaction([
    prisma.email.update({
      where: { id: emailId },
      data: {
        correctedBucket: newBucket,
        correctedAt: new Date(),
      },
    }),
    prisma.correctionLog.create({
      data: {
        emailId,
        originalBucket,
        correctedBucket: newBucket,
        emailSubject: email.subject,
        emailSender: email.sender,
        reason,
      },
    }),
  ]);

  return Response.json({ success: true });
}
