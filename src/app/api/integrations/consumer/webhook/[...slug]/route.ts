import { POST as mainWebhookPost } from "../route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mainWebhookPost(request);
}

export async function GET() {
  return Response.json({ ok: true });
}
