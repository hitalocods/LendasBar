import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapOrderToConsumerPayload } from "@/lib/consumer-api";

export const dynamic = "force-dynamic";

function extractTargetId(slugs: string[], searchParams: URLSearchParams): string | null {
  const queryId = searchParams.get("id") || searchParams.get("orderId");
  if (queryId) return queryId;

  // Filtra tokens literais como "{id}" ou "%7Bid%7D" caso o Consumer tenha anexado o ID depois do template
  const validSlugs = slugs.filter(
    (s) => s && s !== "{id}" && s !== "%7Bid%7D" && s !== "order" && s !== "orders"
  );

  return validSlugs[validSlugs.length - 1] || null;
}

/**
 * Endpoint de Consulta de Detalhes do Pedido da API Oficial do Consumer
 * Suporta qualquer combinação de rota (/orders/ID, /orders/{id}/ID, /orders/%7Bid%7D/ID)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug = [] } = await params;
  const { searchParams } = new URL(request.url);
  const id = extractTargetId(slug, searchParams);

  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const db = getDb();
  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: { select: { number: true } },
      items: {
        include: {
          product: { select: { consumerCode: true } }
        }
      }
    }
  });

  if (!order) {
    console.warn(`[Consumer Orders GET] Order not found for id: ${id}`);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const payload = mapOrderToConsumerPayload({
    id: order.id,
    restaurantId: order.restaurantId,
    customerName: order.customerName,
    tableNumber: order.table.number,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productCode: item.product?.consumerCode || null,
      quantity: item.quantity,
      unitCents: item.unitCents,
      notes: item.notes
    }))
  });

  // Marca como SYNCED quando o Consumer consome os detalhes do pedido
  await db.order.update({
    where: { id: order.id },
    data: { syncStatus: "SYNCED", syncedAt: new Date() }
  }).catch((err) => console.error("[Consumer Orders GET] syncStatus update failed:", err));

  return NextResponse.json({
    item: payload,
    statusCode: 0,
    reasonPhrase: null
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug = [] } = await params;
  const { searchParams } = new URL(request.url);
  const id = extractTargetId(slug, searchParams);

  try {
    const body = await request.json().catch(() => ({}));
    const db = getDb();
    const consumerId = body.consumer_id || body.id_consumer || body.id;

    if (consumerId && id) {
      await db.order.update({
        where: { id },
        data: {
          consumerOrderId: String(consumerId),
          syncStatus: "SYNCED",
          syncedAt: new Date()
        }
      }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      statusCode: 0,
      reasonPhrase: null
    });
  } catch (error) {
    console.error("[Consumer Orders ID POST Error]:", error);
    return NextResponse.json({ statusCode: 0, reasonPhrase: null });
  }
}
