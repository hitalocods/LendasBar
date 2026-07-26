import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ waiters: [] });
  }

  const db = getDb();
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) return NextResponse.json({ waiters: [] });

  const waiters = await db.user.findMany({
    where: {
      restaurantId: restaurant.id,
      role: "WAITER"
    },
    include: {
      assignedTables: { select: { number: true } }
    },
    orderBy: { name: "asc" }
  });

  return NextResponse.json({
    waiters: waiters.map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      tables: w.assignedTables.map((t) => t.number).join(", ") || "Nenhuma"
    }))
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Nome do garçom é obrigatório" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", waiter: { id: `demo_${Date.now()}`, name } });
  }

  const db = getDb();
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) return NextResponse.json({ error: "Restaurante não encontrado" }, { status: 404 });

  const email = body.email?.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@lendas.local`;

  const waiter = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      name,
      email,
      role: "WAITER"
    }
  });

  return NextResponse.json({ waiter });
}
