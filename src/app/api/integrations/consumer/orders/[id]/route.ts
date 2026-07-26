import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapOrderToConsumerPayload } from "@/lib/consumer-api";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Consulta de Detalhes do Pedido da API Oficial do Consumer
 * O Consumer faz GET com o ID do pedido para receber a estrutura completa JSON.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
