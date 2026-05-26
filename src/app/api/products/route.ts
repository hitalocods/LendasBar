import { NextResponse } from "next/server";
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

type ProductsDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  category: {
    upsert: (args: unknown) => Promise<{ id: string; name: string }>;
  };
  product: {
    findMany: (args: unknown) => Promise<ProductRecord[]>;
    create: (args: unknown) => Promise<ProductRecord>;
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

async function getRestaurant(db: ProductsDb) {
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
    return NextResponse.json({ products: [] });
  }

  const db = getDb() as unknown as ProductsDb;
  const restaurant = await getRestaurant(db);
  const products = await db.product.findMany({
    where: { restaurantId: restaurant.id, active: true },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } }
  });

  return NextResponse.json(
    { products: products.map(toClientProduct) },
    { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    imageUrl?: string;
  };

  if (!body.name?.trim() || !body.description?.trim() || !body.category?.trim() || !body.price) {
    return NextResponse.json({ error: "Product name, description, category and price are required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", product: body });
  }

  const db = getDb() as unknown as ProductsDb;
  const restaurant = await getRestaurant(db);
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

  const product = await db.product.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: body.name.trim(),
      description: body.description.trim(),
      imageUrl: body.imageUrl?.trim() || null,
      priceCents: Math.round(Number(body.price) * 100)
    },
    include: { category: { select: { name: true } } }
  });

  return NextResponse.json({ product: toClientProduct(product) });
}
