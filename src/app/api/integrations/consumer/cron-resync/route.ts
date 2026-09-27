import { NextResponse } from "next/server";
import { executeAtomicResync } from "../resync/route";

export const dynamic = "force-dynamic";

/**
 * Endpoint do Vercel Cron (ou Webhook Externo ex: cron-job.org / UpTimeRobot)
 * Executado a cada 5 minutos
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;

  const isAuthorized =
    isVercelCron ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    process.env.NODE_ENV === "development";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") || undefined;

  const result = await executeAtomicResync(orderId);
  return NextResponse.json({ cronExecuted: true, timestamp: new Date().toISOString(), result });
}

export async function POST(request: Request) {
  return GET(request);
}
