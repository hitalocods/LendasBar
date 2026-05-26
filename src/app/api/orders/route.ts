import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type OrderPayload = {
  restaurantId?: string;
  tableId?: string;
  tableToken?: string;
  sessionId?: string;
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
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      customerName: string;
      status: string;
      createdAt: Date;
      table: { number: number };
      items: Array<{ productName: string; quantity: number; unitCents: number }>;
    }>>;
    create: (args: unknown) => Promise<unknown>;
  };
  table: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      restaurantId: string;
      currentSessionId: string | null;
      currentSession: { id: string } | null;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    create: (args: unknown) => Promise<{ id: string }>;
  };
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado"
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ orders: [] });
  }

  const db = getDb() as unknown as OrdersRouteDb;
  const orders = await db.order.findMany({
    where: {
      status: { not: "CANCELLED" }
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      table: { select: { number: true } },
      items: { select: { productName: true, quantity: true, unitCents: true } }
    }
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      table: `Mesa ${order.table.number}`,
      guest: order.customerName,
      items: order.items.map((item) => `${item.quantity}x ${item.productName}`),
      total: order.items.reduce((total, item) => total + item.quantity * item.unitCents, 0) / 100,
      status: statusLabel[order.status] ?? "Pendente",
      minutes: Math.max(0, Math.round((Date.now() - order.createdAt.getTime()) / 60000))
    }))
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate"
    }
  });
}

type OrdersRouteDbWrite = {
  order: {
    create: (args: unknown) => Promise<unknown>;
  };
  table: OrdersRouteDb["table"];
  tableSession: OrdersRouteDb["tableSession"];
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

  const db = getDb() as unknown as OrdersRouteDbWrite;

  let restaurantId = payload.restaurantId;
  let tableId = payload.tableId;
  let sessionId = payload.sessionId;

  if (payload.tableToken) {
    const table = await db.table.findUnique({
      where: { qrToken: payload.tableToken },
      include: { currentSession: true }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    restaurantId = table.restaurantId;
    tableId = table.id;
    sessionId =
      table.currentSession?.id ??
      (
        await db.tableSession.create({
          data: {
            restaurantId: table.restaurantId,
            tableId: table.id
          }
        })
      ).id;

    if (!table.currentSessionId) {
      await db.table.update({
        where: { id: table.id },
        data: {
          currentSessionId: sessionId,
          status: "OCCUPIED"
        }
      });
    }
  }

  if (!restaurantId || !tableId || !sessionId) {
    return NextResponse.json({ error: "Order requires table/session context" }, { status: 400 });
  }

  const order = await db.order.create({
    data: {
      restaurantId,
      tableId,
      sessionId,
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
