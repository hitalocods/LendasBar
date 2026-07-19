import { NextResponse } from "next/server";
import { hashPassword, hasStaffAccess, StaffRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserRecord = {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  createdAt: Date;
};

type UserDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  user: {
    findMany: (args: unknown) => Promise<UserRecord[]>;
    create: (args: unknown) => Promise<UserRecord>;
  };
};

export async function GET() {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ users: [] });
  }

  try {
    const db = getDb() as unknown as UserDb;
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" },
      select: { id: true }
    });

    if (!restaurant) return NextResponse.json({ users: [] });

    const users = await db.user.findMany({
      where: { restaurantId: restaurant.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(
      { users },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
    );
  } catch {
    return NextResponse.json({ users: [] });
  }
}

export async function POST(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    role?: StaffRole;
    password?: string;
  };

  if (!body.name?.trim() || !body.email?.trim() || !body.password || !body.role) {
    return NextResponse.json({ error: "Name, email, role and password are required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      user: {
        id: `user_${Date.now()}`,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        role: body.role
      }
    });
  }

  const db = getDb() as unknown as UserDb;
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const user = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      role: body.role,
      passwordHash: hashPassword(body.password)
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  return NextResponse.json({ user });
}
