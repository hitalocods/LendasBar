import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type OrderPayload = {
  restaurantId: string;
  tableId: string;
  sessionId: string;
  sessionUserId?: string;
  customerName: string;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitCents: number;
    notes?: string;
  }>;
};

type OrdersRouteDb = {
  order: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json()) as OrderPayload;

  if (!payload.customerName || !payload.items?.length) {
    return NextResponse.json({ error: "Order requires customer and items" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      order: {
        id: `demo_order_${Date.now()}`,
        status: "PENDING",
        ...payload
      }
    });
  }

  const db = getDb() as unknown as OrdersRouteDb;
  const order = await db.order.create({
    data: {
      restaurantId: payload.restaurantId,
      tableId: payload.tableId,
      sessionId: payload.sessionId,
      sessionUserId: payload.sessionUserId,
      customerName: payload.customerName,
      items: {
        create: payload.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCents: item.unitCents,
          notes: item.notes
        }))
      }
    },
    include: { items: true }
  });

  return NextResponse.json({ order });
}
