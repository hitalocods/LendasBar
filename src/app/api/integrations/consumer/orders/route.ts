import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapOrderToConsumerPayload } from "@/lib/consumer-api";

export const dynamic = "force-dynamic";

/**
 * Consulta de detalhes do pedido via Query Params (?id=xxx ou ?orderId=xxx)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || searchParams.get("orderId");

  if (!id) {
    return NextResponse.json({ error: "Missing order id query param" }, { status: 400 });
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

  return NextResponse.json({
    item: payload,
    statusCode: 0,
    reasonPhrase: null
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id_externo || body.id;
    const consumerId = body.consumer_id || body.id_consumer;

    if (orderId && consumerId) {
      const db = getDb();
      await db.order.update({
        where: { id: orderId },
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
    console.error("[Consumer Orders POST Error]:", error);
    return NextResponse.json({ statusCode: 0, reasonPhrase: null });
  }
}

