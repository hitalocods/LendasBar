import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

type ExpenseInput = {
  description?: string;
  category?: string;
  amountCents?: number;
  occurredAt?: string;
};

type ExpensesDb = {
  restaurant: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  expense: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      description: string;
      category: string | null;
      amountCents: number;
      occurredAt: Date;
      createdAt: Date;
    }>>;
    create: (args: unknown) => Promise<{
      id: string;
      description: string;
      category: string | null;
      amountCents: number;
      occurredAt: Date;
      createdAt: Date;
    }>;
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
    return NextResponse.json({ expenses: [] });
  }

  const url = new URL(request.url);
  const now = new Date();
  const from = readDateParam(url.searchParams.get("from"), new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const to = readDateParam(url.searchParams.get("to"), new Date(from.getTime() + 24 * 60 * 60 * 1000));

  try {
    const db = getDb() as unknown as ExpensesDb;
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const expenses = await db.expense.findMany({
      where: {
        restaurantId: restaurant.id,
        occurredAt: { gte: from, lt: to }
      },
      orderBy: { occurredAt: "desc" },
      take: 200
    });

    return NextResponse.json({
      expenses: expenses.map((expense) => ({
        ...expense,
        occurredAt: expense.occurredAt.toISOString(),
        createdAt: expense.createdAt.toISOString()
      }))
    });
  } catch {
    return NextResponse.json({ expenses: [], degraded: true });
  }
}

export async function POST(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const payload = (await request.json()) as ExpenseInput;
  const description = String(payload.description ?? "").trim();
  const amountCents = Number(payload.amountCents ?? 0);
  const category = String(payload.category ?? "").trim();
  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();

  if (!description || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid expense payload" }, { status: 400 });
  }

  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid expense date" }, { status: 400 });
  }

  try {
    const db = getDb() as unknown as ExpensesDb;
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const expense = await db.expense.create({
      data: {
        restaurantId: restaurant.id,
        description,
        category: category || null,
        amountCents: Math.round(amountCents),
        occurredAt
      }
    });

    return NextResponse.json({
      expense: {
        ...expense,
        occurredAt: expense.occurredAt.toISOString(),
        createdAt: expense.createdAt.toISOString()
      }
    });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
