import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type CategoryDb = {
  restaurant: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  category: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      name: string;
      sortOrder: number;
      active: boolean;
      _count?: { products: number };
    }>>;
    create: (args: unknown) => Promise<unknown>;
  };
};

async function getRestaurant(db: CategoryDb) {
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) {
    throw new Error("Restaurant not found. Run npm run db:seed first.");
  }

  return restaurant;
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ categories: [] });
  }

  try {
    const db = getDb() as unknown as CategoryDb;
    const restaurant = await getRestaurant(db);

    const categories = await db.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    return NextResponse.json(
      {
        categories: categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          active: cat.active,
          productCount: cat._count?.products ?? 0
        }))
      },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
    );
  } catch {
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; sortOrder?: number };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ category: { id: `demo_${Date.now()}`, name: body.name.trim(), sortOrder: body.sortOrder ?? 0, active: true, productCount: 0 } });
  }

  const db = getDb() as unknown as CategoryDb;
  const restaurant = await getRestaurant(db);

  const category = await (db.category as unknown as { create: (args: unknown) => Promise<{ id: string; name: string; sortOrder: number; active: boolean }> }).create({
    data: {
      restaurantId: restaurant.id,
      name: body.name.trim(),
      sortOrder: Number(body.sortOrder ?? 0)
    }
  });

  return NextResponse.json({
    category: {
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      productCount: 0
    }
  });
}
