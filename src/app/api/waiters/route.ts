import { NextResponse } from "next/server";
import { hashPassword, hasStaffAccess, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const db = getDb();
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (restaurant) {
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

      if (waiters.length > 0) {
        return NextResponse.json({
          waiters: waiters.map((w) => ({
            id: w.id,
            name: w.name,
            email: w.email,
            tables: w.assignedTables.map((t) => t.number).join(", ") || "Todas"
          }))
        });
      }
    }
  } catch (err) {
    console.warn("[api/waiters] Banco indisponível, usando memoryStore:", err);
  }

  return NextResponse.json({
    waiters: memoryStore.waiters.map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      tables: "Todas as mesas"
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

  const email = body.email?.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@lendas.local`;

  // Registra no memoryStore
  const newWaiter = {
    id: `waiter-${Date.now()}`,
    name,
    email,
    role: "WAITER" as const,
    passwordHash: hashPassword(password)
  };
  memoryStore.waiters.push(newWaiter);

  try {
    const db = getDb();
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (restaurant) {
      const existingUsers = await db.user.findMany({
        where: { restaurantId: restaurant.id, passwordHash: { not: null } },
        select: { passwordHash: true }
      });

      const isConflict = existingUsers.some((u) => u.passwordHash && verifyPassword(password, u.passwordHash));
      if (isConflict) {
        return NextResponse.json({ error: "Essa senha já pertence a outro usuário. Escolha uma senha diferente." }, { status: 409 });
      }

      const waiter = await db.user.create({
        data: {
          restaurantId: restaurant.id,
          name,
          email,
          role: "WAITER",
          passwordHash: hashPassword(password)
        }
      });

      return NextResponse.json({ waiter });
    }
  } catch (err) {
    console.warn("[api/waiters] Banco indisponível, salvo no memoryStore:", err);
  }

  return NextResponse.json({ waiter: newWaiter });
}
