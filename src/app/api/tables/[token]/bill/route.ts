import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type BillDb = {
  table: {
    findUnique: (args: unknown) => Promise<null | {
      number: number;
      currentSession: null | {
        id: string;
        status: string;
        orders: Array<{
          id: string;
          customerName: string;
          status: string;
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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ table: token, groups: [], total: 0 });
  }

  const db = getDb() as unknown as BillDb;
  const table = await db.table.findUnique({
    where: { qrToken: token },
    include: {
      currentSession: {
        include: {
          orders: {
            include: {
              items: { select: { productName: true, quantity: true, unitCents: true } }
            }
          }
        }
      }
    }
  });

  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const groups = new Map<string, Array<{ label: string; value: number }>>();

  for (const order of table.currentSession?.orders ?? []) {
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
    sessionId: table.currentSession?.id ?? null,
    status: table.currentSession?.status ?? "CLOSED",
    groups: grouped,
    total: grouped.reduce((sum, group) => sum + group.total, 0)
  });
}
