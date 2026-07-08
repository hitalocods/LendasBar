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

type ComparableOrderItem = {
  productId?: string;
  productName: string;
  quantity: number;
  unitCents: number;
  notes?: string;
};

const DUPLICATE_WINDOW_MS = 12_000;

function normalizeOrderItems(items: ComparableOrderItem[]) {
  return [...items]
    .map((item) => ({
      productId: item.productId ?? "",
      productName: item.productName.trim().toLowerCase(),
      quantity: item.quantity,
      unitCents: item.unitCents,
      notes: item.notes?.trim().toLowerCase() ?? ""
    }))
    .sort((a, b) => {
      const keyA = `${a.productId}|${a.productName}|${a.unitCents}|${a.notes}`;
      const keyB = `${b.productId}|${b.productName}|${b.unitCents}|${b.notes}`;
      return keyA.localeCompare(keyB) || a.quantity - b.quantity;
    });
}

function orderFingerprint(items: ComparableOrderItem[]) {
  return JSON.stringify(normalizeOrderItems(items));
}

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
      createdAt: order.createdAt.toISOString(),
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
    findFirst: (args: unknown) => Promise<{
      id: string;
      createdAt: Date;
      items: Array<ComparableOrderItem>;
    } | null>;
    create: (args: unknown) => Promise<unknown>;
  };
  table: OrdersRouteDb["table"];
  tableSession: OrdersRouteDb["tableSession"];
  $transaction: <T>(fn: (tx: OrdersRouteDbWrite) => Promise<T>) => Promise<T>;
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
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

  const incomingFingerprint = orderFingerprint(payload.items);
  const lockKey = `order:${sessionId}:${payload.sessionUserId ?? payload.customerName.trim().toLowerCase()}`;
  const duplicateCutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const result = await db.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS locked
    `;

    if (!lockRows?.[0]?.locked) {
      return {
        duplicated: true,
        busy: true,
        orderId: null as string | null
      };
    }

    const recentOrder = await tx.order.findFirst({
      where: {
        sessionId,
        customerName: payload.customerName,
        sessionUserId: payload.sessionUserId ?? null,
        createdAt: { gte: duplicateCutoff },
        status: { not: "CANCELLED" }
      },
      include: {
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            unitCents: true,
            notes: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    if (recentOrder && orderFingerprint(recentOrder.items) === incomingFingerprint) {
      return {
        duplicated: true,
        busy: false,
        orderId: recentOrder.id
      };
    }

    const order = await tx.order.create({
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

    return {
      duplicated: false,
      busy: false,
      order
    };
  });

  if (result.duplicated) {
    return NextResponse.json(
      {
        error: result.busy ? "Seu pedido ainda esta sendo processado." : "Pedido duplicado detectado.",
        duplicate: true,
        busy: result.busy,
        orderId: result.orderId
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ order: result.order });
}
