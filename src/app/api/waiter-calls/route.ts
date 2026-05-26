import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type WaiterCallPayload = {
  restaurantId: string;
  tableId: string;
  sessionId: string;
  customerName: string;
  type: "WAITER" | "BILL";
};

type WaiterCallsRouteDb = {
  waiterCall: {
    create: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    update: (args: unknown) => Promise<unknown>;
  };
};

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
