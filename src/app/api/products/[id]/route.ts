import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceCents: number;
  active: boolean;
  category: { name: string } | null;
};

type ProductDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  category: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
  product: {
    update: (args: unknown) => Promise<ProductRecord>;
  };
};

function toClientProduct(product: ProductRecord) {
  return {
    id: product.id,
    name: product.name,
    desc: product.description,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.priceCents / 100,
    category: product.category?.name ?? "Cardapio",
    active: product.active,
    tone: "from-red-700/30 to-zinc-950"
  };
}

async function getRestaurant(db: ProductDb) {
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) throw new Error("Restaurant not found");
  return restaurant;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    imageUrl?: string;
    active?: boolean;
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", product: { id, ...body } });
  }

  const db = getDb() as unknown as ProductDb;
  const restaurant = await getRestaurant(db);
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl.trim() || null;
  if (body.price !== undefined) data.priceCents = Math.round(Number(body.price) * 100);
  if (body.active !== undefined) data.active = body.active;

  if (body.category?.trim()) {
    const category = await db.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: body.category.trim()
        }
      },
      update: { active: true },
      create: {
        restaurantId: restaurant.id,
        name: body.category.trim()
      }
    });
    data.categoryId = category.id;
  }

  const product = await db.product.update({
    where: { id },
    data,
    include: { category: { select: { name: true } } }
  });

  return NextResponse.json({ product: toClientProduct(product) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", product: { id, active: false } });
  }

  const db = getDb() as unknown as ProductDb;
  const product = await db.product.update({
    where: { id },
    data: { active: false },
    include: { category: { select: { name: true } } }
  });

  return NextResponse.json({ product: toClientProduct(product) });
}
