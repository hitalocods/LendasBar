import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

const nextStatus: Record<string, string> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
  DELIVERED: "DELIVERED"
};

type AdvanceOrderDb = {
  order: {
    findUnique: (args: unknown) => Promise<{ id: string; status: string } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("KITCHEN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const db = getDb() as unknown as AdvanceOrderDb;
    const order = await db.order.findUnique({
      where: { id },
      select: { id: true, status: true }
    });

    if (order) {
      const updatedOrder = await db.order.update({
        where: { id },
        data: {
          status: nextStatus[order.status] ?? "CONFIRMED"
        }
      });

      return NextResponse.json({ order: updatedOrder });
    }
  } catch (err) {
    console.warn("[api/orders/advance] Banco indisponível, usando memoryStore:", err);
  }

  const memOrder = memoryStore.advanceOrderStatus(id);
  if (memOrder) {
    return NextResponse.json({ order: memOrder });
  }

  return NextResponse.json({ mode: "demo", order: { id, status: "CONFIRMED" } });
}
