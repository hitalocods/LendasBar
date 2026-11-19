import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasStaffAccess } from "@/lib/auth";
import { memoryStore } from "@/lib/memory-store";

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
      number: number;
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
  if (!(await hasStaffAccess("KITCHEN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const db = getDb() as unknown as OrdersRouteDb;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await db.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfDay }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        table: { select: { number: true } },
        items: { select: { productName: true, quantity: true, unitCents: true } }
      }
    });

    if (orders.length > 0) {
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
        headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" }
      });
    }
  } catch (err) {
    console.warn("[api/orders] Banco indisponível, usando memoryStore:", err);
  }

  // Fallback resiliente usando memoryStore
  return NextResponse.json({
    orders: memoryStore.orders.map((o) => ({
      id: o.id,
      table: `Mesa ${o.tableNumber}`,
      guest: o.customerName,
      items: o.items.map((item) => `${item.quantity}x ${item.productName}`),
      total: o.totalCents / 100,
      status: statusLabel[o.status] ?? "Pendente",
      createdAt: o.createdAt.toISOString(),
      minutes: Math.max(0, Math.round((Date.now() - o.createdAt.getTime()) / 60000))
    }))
  }, {
    headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" }
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
  let payload: OrderPayload | null = null;
  try {
    const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-real-ip") || "client_ip";
    const ip = rawIp.split(",")[0].trim();
    const rateLimit = checkRateLimit(`order_${ip}`, 15, 10_000);

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Muitas requisições em curto intervalo. Aguarde alguns segundos." }, { status: 429 });
    }

    payload = (await request.json()) as OrderPayload;

    if (!payload || !payload.customerName || !payload.items?.length) {
      return NextResponse.json({ error: "Order requires customer and items" }, { status: 400 });
    }

    const currentPayload = payload;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      order: {
        id: `demo_order_${Date.now()}`,
        status: "PENDING",
        ...currentPayload
      }
    });
  }

  const db = getDb() as unknown as OrdersRouteDbWrite;

  let restaurantId = currentPayload.restaurantId;
  let tableId = currentPayload.tableId;
  let sessionId = currentPayload.sessionId;

  if (currentPayload.tableToken) {
    const table = await db.table.findUnique({
      where: { qrToken: currentPayload.tableToken },
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

    await db.table.update({
      where: { id: table.id },
      data: {
        currentSessionId: sessionId,
        status: "OCCUPIED"
      }
    });
  } else if (tableId) {
    await db.table.update({
      where: { id: tableId },
      data: {
        currentSessionId: sessionId,
        status: "OCCUPIED"
      }
    }).catch(() => {});
  }

  if (!restaurantId || !tableId || !sessionId) {
    return NextResponse.json({ error: "Order requires table/session context" }, { status: 400 });
  }

  const incomingFingerprint = orderFingerprint(currentPayload.items);
  const lockKey = `order:${sessionId}:${currentPayload.sessionUserId ?? currentPayload.customerName.trim().toLowerCase()}`;
  const duplicateCutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const result = await db.$transaction(async (tx) => {
    let isLocked = true;
    try {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS locked
      `;
      if (lockRows && lockRows.length > 0) {
        isLocked = Boolean(lockRows[0].locked);
      }
    } catch {
      isLocked = true;
    }

    if (!isLocked) {
      return {
        duplicated: true,
        busy: true,
        orderId: null as string | null
      };
    }

    const recentOrder = await tx.order.findFirst({
      where: {
        sessionId,
        customerName: currentPayload.customerName,
        sessionUserId: currentPayload.sessionUserId ?? null,
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
        sessionUserId: currentPayload.sessionUserId,
        customerName: currentPayload.customerName,
        items: {
          create: currentPayload.items.map((item) => ({
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
  } catch (error) {
    console.warn("[Orders POST, falling back to memoryStore]:", error);
    try {
      if (payload && payload.customerName && payload.items?.length) {
        const memOrder = memoryStore.addOrder(
          payload.tableToken || payload.tableId || "1",
          payload.customerName,
          payload.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            unitCents: i.unitCents,
            notes: i.notes
          }))
        );
        return NextResponse.json({ order: memOrder, mode: "resilient" });
      }
    } catch {}
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal order error" }, { status: 500 });
  }
}
