import { syncEmails } from "../lib/sync.server.js";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await syncEmails();
    return Response.json(result);
  } catch (err) {
    console.error("Sync API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
