import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

type SummaryDb = {
  restaurant: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  order: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      items: Array<{ quantity: number; unitCents: number }>;
    }>>;
  };
  expense: {
    findMany: (args: unknown) => Promise<Array<{ amountCents: number }>>;
  };
};

function readDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      from: null,
      to: null,
      revenueCents: 0,
      expensesCents: 0,
      netCents: 0,
      deliveredOrders: 0
    });
  }

  const url = new URL(request.url);
  const now = new Date();
  const from = readDateParam(url.searchParams.get("from"), new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const to = readDateParam(url.searchParams.get("to"), new Date(from.getTime() + 24 * 60 * 60 * 1000));

  try {
    const db = getDb() as unknown as SummaryDb;
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const [deliveredOrders, expenses] = await Promise.all([
      db.order.findMany({
        where: {
          restaurantId: restaurant.id,
          status: "DELIVERED",
          createdAt: { gte: from, lt: to }
        },
        select: {
          id: true,
          items: { select: { quantity: true, unitCents: true } }
        }
      }),
      db.expense.findMany({
        where: {
          restaurantId: restaurant.id,
          occurredAt: { gte: from, lt: to }
        },
        select: { amountCents: true }
      })
    ]);

    const revenueCents = deliveredOrders.reduce(
      (ordersTotal, order) =>
        ordersTotal + order.items.reduce((itemsTotal, item) => itemsTotal + item.quantity * item.unitCents, 0),
      0
    );
    const expensesCents = expenses.reduce((total, expense) => total + expense.amountCents, 0);

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      revenueCents,
      expensesCents,
      netCents: revenueCents - expensesCents,
      deliveredOrders: deliveredOrders.length
    });
  } catch {
    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      revenueCents: 0,
      expensesCents: 0,
      netCents: 0,
      deliveredOrders: 0,
      degraded: true
    });
  }
}
