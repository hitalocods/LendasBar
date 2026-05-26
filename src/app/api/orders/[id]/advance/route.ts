import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      order: { id, status: "CONFIRMED" }
    });
  }

  const db = getDb() as unknown as AdvanceOrderDb;
  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, status: true }
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updatedOrder = await db.order.update({
    where: { id },
    data: {
      status: nextStatus[order.status] ?? "CONFIRMED"
    }
  });

  return NextResponse.json({ order: updatedOrder });
}
