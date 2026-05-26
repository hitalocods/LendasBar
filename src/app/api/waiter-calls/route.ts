import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type WaiterCallPayload = {
  restaurantId: string;
  tableId: string;
  sessionId: string;
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
      table: { number: number };
    }>>;
    create: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ calls: [] });
  }

  const db = getDb() as unknown as WaiterCallsRouteDb;
  const calls = await db.waiterCall.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { table: { select: { number: true } } }
  });

  return NextResponse.json({
    calls: calls.map((call) => ({
      id: call.id,
      table: `Mesa ${call.table.number}`,
      customerName: call.customerName,
      type: call.type,
      status: call.status,
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
  const waiterCall = await db.waiterCall.create({ data: payload });

  if (payload.type === "BILL") {
    await db.tableSession.update({
      where: { id: payload.sessionId },
      data: { status: "CLOSING" }
    });
  }

  return NextResponse.json({ waiterCall });
}
