import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type WaiterCallPayload = {
  restaurantId?: string;
  tableId?: string;
  tableToken?: string;
  sessionId?: string;
  customerName: string;
  type: "WAITER" | "BILL";
};

type WaiterCallsRouteDb = {
  waiterCall: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      customerName: string;
      type: string;
      status: string;
      createdAt: Date;
      table: { number: number; assignedWaiter: null | { id: string; name: string } };
      assignedWaiter: null | { id: string; name: string };
    }>>;
    create: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<unknown>;
  };
  table: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      restaurantId: string;
      currentSessionId: string | null;
      assignedWaiterId: string | null;
      currentSession: { id: string } | null;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ calls: [] });
  }

  const { searchParams } = new URL(request.url);
  const waiterId = searchParams.get("waiterId");
  const db = getDb() as unknown as WaiterCallsRouteDb;
  const calls = await db.waiterCall.findMany({
    where: {
      status: { not: "RESOLVED" },
      ...(waiterId ? { assignedWaiterId: waiterId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      assignedWaiter: { select: { id: true, name: true } },
      table: {
        select: {
          number: true,
          assignedWaiter: { select: { id: true, name: true } }
        }
      }
    }
  });

  return NextResponse.json({
    calls: calls.map((call) => ({
      id: call.id,
      table: `Mesa ${call.table.number}`,
      customerName: call.customerName,
      type: call.type,
      status: call.status,
      waiter: call.assignedWaiter ?? call.table.assignedWaiter,
      minutes: Math.max(0, Math.round((Date.now() - call.createdAt.getTime()) / 60000))
    }))
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as WaiterCallPayload;

  if (!payload.customerName || !payload.type) {
    return NextResponse.json({ error: "Waiter call requires customer and type" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      waiterCall: {
        id: `demo_call_${Date.now()}`,
        status: "OPEN",
        ...payload
      }
    });
  }

  const db = getDb() as unknown as WaiterCallsRouteDb;
  let restaurantId = payload.restaurantId;
  let tableId = payload.tableId;
  let sessionId = payload.sessionId;
  let assignedWaiterId: string | null = null;

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
    assignedWaiterId = table.assignedWaiterId;
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
          status: payload.type === "BILL" ? "WAITING_BILL" : "OCCUPIED"
        }
      });
    }
  }

  if (!restaurantId || !tableId || !sessionId) {
    return NextResponse.json({ error: "Waiter call requires table/session context" }, { status: 400 });
  }

  const waiterCall = await db.waiterCall.create({
    data: {
      restaurantId,
      tableId,
      sessionId,
      customerName: payload.customerName,
      type: payload.type,
      assignedWaiterId
    }
  });

  if (payload.type === "BILL") {
    await db.tableSession.update({
      where: { id: sessionId },
      data: { status: "CLOSING" }
    });
    await db.table.update({
      where: { id: tableId },
      data: { status: "WAITING_BILL" }
    });
  }

  return NextResponse.json({ waiterCall });
}
