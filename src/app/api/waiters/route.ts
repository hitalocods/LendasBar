import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const demoWaiters = [
  { id: "waiter_joao", name: "Joao", email: "joao@lendas.local", tables: "1-6" },
  { id: "waiter_maria", name: "Maria", email: "maria@lendas.local", tables: "7-12" },
  { id: "waiter_pedro", name: "Pedro", email: "pedro@lendas.local", tables: "13-20" }
];

type WaitersDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  user: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      name: string;
      email: string | null;
      assignedTables: Array<{ number: number }>;
    }>>;
  };
};

function summarizeTables(numbers: number[]) {
  if (!numbers.length) return "Sem mesas";

  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (const number of sorted.slice(1)) {
    if (number === previous + 1) {
      previous = number;
      continue;
    }

    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = number;
    previous = number;
  }

  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(", ");
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ waiters: demoWaiters });
  }

  const db = getDb() as unknown as WaitersDb;
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
    orderBy: { name: "asc" },
    include: {
      assignedTables: {
        select: { number: true },
        orderBy: { number: "asc" }
      }
    }
  });

  return NextResponse.json({
    waiters: waiters.map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      email: waiter.email,
      tables: summarizeTables(waiter.assignedTables.map((table) => table.number))
    }))
  });
}
