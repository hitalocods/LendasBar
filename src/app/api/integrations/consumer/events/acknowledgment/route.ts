import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Confirmação de Eventos (Acknowledgment)
 * Padrão Open Delivery / Programa Consumer
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ([]));
    const items = Array.isArray(body) ? body : (body.items || []);
    const eventIds = items.map((i: any) => i.id || i.orderId).filter(Boolean);
    const orderIds = eventIds.map((id: string) => String(id).replace(/^evt_/, ""));
    if (orderIds.length > 0) {
      const db = getDb();
      await db.order.updateMany({
        where: { id: { in: orderIds } },
        data: { syncStatus: "SYNCED", syncedAt: new Date() }
      }).catch(console.error);
    }
  } catch {}
  return NextResponse.json({
    statusCode: 0,
    reasonPhrase: null
  });
}
