import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendOrderToConsumer } from "@/lib/consumer-api";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasStaffAccess } from "@/lib/auth";

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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ orders: [] });
  }

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
  try {
    const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-real-ip") || "client_ip";
    const ip = rawIp.split(",")[0].trim();
    const rateLimit = checkRateLimit(`order_${ip}`, 15, 10_000);

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Muitas requisições em curto intervalo. Aguarde alguns segundos." }, { status: 429 });
    }

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
  let tableNumber: number | undefined = undefined;

  if (payload.tableToken) {
    const table = await db.table.findUnique({
      where: { qrToken: payload.tableToken },
      include: { currentSession: true }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    tableNumber = table.number;
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

  const incomingFingerprint = orderFingerprint(payload.items);
  const lockKey = `order:${sessionId}:${payload.sessionUserId ?? payload.customerName.trim().toLowerCase()}`;
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

  // Disparo assíncrono para o Consumer (PDV)
  if (result.order && typeof result.order === "object" && "id" in result.order) {
    const createdOrder = result.order as {
      id: string;
      customerName: string;
      items: Array<{ productName: string; quantity: number; unitCents: number; notes?: string | null }>;
    };

    sendOrderToConsumer({
      id: createdOrder.id,
      restaurantId: restaurantId!,
      customerName: createdOrder.customerName,
      tableNumber,
      createdAt: new Date(),
      items: createdOrder.items.map((i, idx) => ({
        id: `item_${createdOrder.id}_${idx}`,
        productName: i.productName,
        productCode: null,
        quantity: i.quantity,
        unitCents: i.unitCents,
        notes: i.notes
      }))
    }).then(async (syncResult) => {
      const dbInst = getDb() as unknown as { order: { update: (args: unknown) => Promise<unknown> } };
      if (syncResult.success) {
        await dbInst.order.update({
          where: { id: createdOrder.id },
          data: {
            consumerOrderId: syncResult.consumerOrderId,
            syncStatus: "SYNCED",
            syncedAt: new Date()
          }
        }).catch(console.error);
      } else {
        // Mantém PENDING para o Polling do Consumer Desktop puxar
        await dbInst.order.update({
          where: { id: createdOrder.id },
          data: { syncStatus: "PENDING" }
        }).catch(console.error);
      }
    }).catch(console.error);
  }

  return NextResponse.json({ order: result.order });
  } catch (error) {
    console.error("[Orders POST Error]:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal order error" }, { status: 500 });
  }
}
