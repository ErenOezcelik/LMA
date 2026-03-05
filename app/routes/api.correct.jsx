import { prisma } from "../lib/db.server.js";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const emailId = formData.get("emailId");
  const newBucket = formData.get("bucket");
  const reason = formData.get("reason") || null;

  if (!emailId || !newBucket) {
    return Response.json({ error: "emailId und bucket sind erforderlich" }, { status: 400 });
  }

  const validBuckets = ["tradion", "staubfilter", "rest"];
  if (!validBuckets.includes(newBucket)) {
    return Response.json({ error: "Ungültiger Bucket" }, { status: 400 });
  }

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
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
