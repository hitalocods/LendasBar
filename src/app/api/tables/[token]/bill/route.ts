import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

type BillDb = {
  table: {
    findUnique: (args: unknown) => Promise<null | {
      number: number;
      currentSession: null | {
        id: string;
        status: string;
        openedAt: Date;
        users: Array<{ id: string; name: string; active: boolean }>;
        orders: Array<{
          id: string;
          customerName: string;
          status: string;
          createdAt: Date;
          items: Array<{ productName: string; quantity: number; unitCents: number }>;
        }>;
      };
    }>;
  };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const db = getDb() as unknown as BillDb;
    const table = await db.table.findUnique({
      where: { qrToken: token },
      include: {
        currentSession: {
          include: {
            users: { select: { id: true, name: true, active: true } },
            orders: {
              include: {
                items: { select: { productName: true, quantity: true, unitCents: true } }
              }
            }
          }
        }
      }
    });

    if (table) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const currentSession = table.currentSession;
      const isOldSession = currentSession && (new Date(currentSession.openedAt) < startOfDay || currentSession.status === "CLOSED");

      if (!currentSession || isOldSession) {
        return NextResponse.json({
          table: table.number,
          sessionId: null,
          status: "CLOSED",
          users: [],
          groups: [],
          total: 0
        });
      }

      const groups = new Map<string, Array<{ label: string; value: number }>>();

      for (const order of currentSession.orders ?? []) {
        if (order.status === "CANCELLED") continue;
        if (new Date(order.createdAt) < startOfDay) continue;

        const lines = groups.get(order.customerName) ?? [];
        for (const item of order.items) {
          lines.push({
            label: `${item.quantity}x ${item.productName}`,
            value: item.quantity * item.unitCents
          });
        }
        groups.set(order.customerName, lines);
      }

      const grouped = Array.from(groups.entries()).map(([customerName, lines]) => ({
        customerName,
        lines,
        total: lines.reduce((sum, line) => sum + line.value, 0)
      }));

      return NextResponse.json({
        table: table.number,
        sessionId: currentSession.id,
        status: currentSession.status,
        users: currentSession.users ?? [],
        groups: grouped,
        total: grouped.reduce((sum, group) => sum + group.total, 0)
      });
    }
  } catch (err) {
    console.warn("[api/tables/bill] Banco indisponível, usando memoryStore:", err);
  }

  // Fallback resiliente usando memoryStore
  const memTable = memoryStore.findTable(token);
  if (!memTable) {
    return NextResponse.json({
      table: token,
      sessionId: null,
      status: "CLOSED",
      users: [],
      groups: [],
      total: 0
    });
  }

  const groups = new Map<string, Array<{ label: string; value: number }>>();
  for (const order of memTable.orders) {
    if (order.status === "CANCELLED") continue;
    const lines = groups.get(order.customerName) ?? [];
    for (const item of order.items) {
      lines.push({
        label: `${item.quantity}x ${item.productName}`,
        value: item.quantity * item.unitCents
      });
    }
    groups.set(order.customerName, lines);
  }

  const grouped = Array.from(groups.entries()).map(([customerName, lines]) => ({
    customerName,
    lines,
    total: lines.reduce((sum, line) => sum + line.value, 0)
  }));

  return NextResponse.json({
    table: memTable.number,
    sessionId: memTable.currentSessionId,
    status: memTable.currentSessionId ? "ACTIVE" : "CLOSED",
    users: memTable.guests.map((g, idx) => ({ id: `user-${idx}`, name: g, active: true })),
    groups: grouped,
    total: grouped.reduce((sum, group) => sum + group.total, 0)
  });
}
