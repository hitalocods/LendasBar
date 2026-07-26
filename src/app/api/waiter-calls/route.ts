import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ calls: [] });
  }

  const db = getDb();
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) return NextResponse.json({ calls: [] });

  const calls = await db.waiterCall.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { not: "RESOLVED" }
    },
    include: {
      table: { select: { number: true, assignedWaiter: { select: { id: true, name: true } } } },
      assignedWaiter: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({
    calls: calls.map((c) => ({
      id: c.id,
      table: `Mesa ${c.table.number.toString().padStart(2, "0")}`,
      tableNumber: c.table.number,
      customerName: c.customerName,
      type: c.type,
      status: c.status,
      waiter: c.assignedWaiter || c.table.assignedWaiter || null,
      minutes: Math.max(0, Math.round((Date.now() - c.createdAt.getTime()) / 60000)),
      createdAt: c.createdAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    tableToken?: string;
    customerName?: string;
    type?: "WAITER" | "BILL";
  };

  const tableToken = body.tableToken;
  const customerName = body.customerName?.trim() || "Cliente";
  const type = body.type === "BILL" ? "BILL" : "WAITER";

  if (!tableToken) {
    return NextResponse.json({ error: "Token da mesa é obrigatório" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", call: { id: `demo_call_${Date.now()}`, type, status: "OPEN" } });
  }

  const db = getDb();
  const table = await db.table.findUnique({
    where: { qrToken: tableToken },
    include: { currentSession: true }
  });

  if (!table) return NextResponse.json({ error: "Mesa não encontrada" }, { status: 404 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let currentSession = table.currentSession;
  if (!currentSession || currentSession.openedAt < startOfDay || currentSession.status === "CLOSED") {
    currentSession = await db.tableSession.create({
      data: { restaurantId: table.restaurantId, tableId: table.id }
    });
  }

  // Se o tipo for BILL, atualiza o status da mesa para WAITING_BILL
  await db.table.update({
    where: { id: table.id },
    data: {
      currentSessionId: currentSession.id,
      status: type === "BILL" ? "WAITING_BILL" : "OCCUPIED"
    }
  });

  const call = await db.waiterCall.create({
    data: {
      restaurantId: table.restaurantId,
      tableId: table.id,
      sessionId: currentSession.id,
      customerName,
      type,
      assignedWaiterId: table.assignedWaiterId || null
    }
  });

  return NextResponse.json({ call });
}
