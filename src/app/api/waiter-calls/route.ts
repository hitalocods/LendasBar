import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const db = getDb();
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (restaurant) {
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

      if (calls.length > 0 || memoryStore.waiterCalls.length === 0) {
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
    }
  } catch (err) {
    console.warn("[api/waiter-calls] Banco indisponível, usando memoryStore:", err);
  }

  return NextResponse.json({
    calls: memoryStore.waiterCalls.map((c) => ({
      id: c.id,
      table: `Mesa ${c.tableNumber.toString().padStart(2, "0")}`,
      tableNumber: c.tableNumber,
      customerName: c.customerName,
      type: c.type,
      status: c.status,
      waiter: null,
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

  // Sempre registra no memoryStore
  const memCall = memoryStore.addWaiterCall(tableToken, customerName, type);

  try {
    const db = getDb();
    const table = await db.table.findUnique({
      where: { qrToken: tableToken },
      include: { currentSession: true }
    });

    if (table) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let currentSession = table.currentSession;
      if (!currentSession || currentSession.openedAt < startOfDay || currentSession.status === "CLOSED") {
        currentSession = await db.tableSession.create({
          data: { restaurantId: table.restaurantId, tableId: table.id }
        });
      }

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
  } catch (err) {
    console.warn("[api/waiter-calls] Banco indisponível, registrado no memoryStore:", err);
  }

  return NextResponse.json({ call: memCall });
}
