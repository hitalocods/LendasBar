import { NextResponse } from "next/server";
import { hashPassword, hasStaffAccess, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  const name = body.name?.trim();
  const password = body.password?.trim();

  if (!name) {
    return NextResponse.json({ error: "Nome do garçom é obrigatório" }, { status: 400 });
  }

  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Defina uma senha de acesso com pelo menos 4 caracteres" }, { status: 400 });
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

  // O login identifica o usuário só pela senha, então ela precisa ser única.
  const withPassword = await db.user.findMany({
    where: { restaurantId: restaurant.id, passwordHash: { not: null } },
    select: { passwordHash: true }
  });
  const passwordInUse =
    password === "rui2026" ||
    withPassword.some((user) => user.passwordHash && verifyPassword(password, user.passwordHash));

  if (passwordInUse) {
    return NextResponse.json({ error: "Essa senha já está em uso. Escolha outra." }, { status: 409 });
  }

  const waiter = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      name,
      email,
      role: "WAITER",
      passwordHash: hashPassword(password)
    },
    select: { id: true, name: true, email: true, role: true }
  });

  return NextResponse.json({ waiter });
}
