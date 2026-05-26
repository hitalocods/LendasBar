import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type TablesDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  table: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      number: number;
      qrToken: string;
      status: string;
      currentSessionId: string | null;
      currentSession: null | {
        id: string;
        status: string;
        openedAt: Date;
        users: Array<{ id: string; name: string }>;
        orders: Array<{
          id: string;
          customerName: string;
          status: string;
          items: Array<{ quantity: number; unitCents: number }>;
        }>;
      };
    }>>;
  };
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ tables: [] });
  }

  const db = getDb() as unknown as TablesDb;
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) return NextResponse.json({ tables: [] });

  const tables = await db.table.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { number: "asc" },
    include: {
      currentSession: {
        include: {
          users: { select: { id: true, name: true } },
          orders: {
            include: {
              items: { select: { quantity: true, unitCents: true } }
            }
          }
        }
      }
    }
  });

  return NextResponse.json({
    tables: tables.map((table) => ({
      id: table.id,
      number: table.number,
      qrToken: table.qrToken,
      status: table.status,
      sessionId: table.currentSessionId,
      guests: table.currentSession?.users.map((user) => user.name) ?? [],
      total:
        table.currentSession?.orders.reduce(
          (sum, order) =>
            sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitCents, 0),
          0
        ) ?? 0
    }))
  });
}
