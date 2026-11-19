import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceCents: number;
  isFeatured: boolean;
  isPromo: boolean;
  promoPriceCents: number | null;
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

function getProductMockImage(name: string, categoryName?: string) {
  const n = (name || "").toLowerCase();
  const cat = (categoryName || "").toLowerCase();

  if (n.includes("hamburguer") || cat.includes("hamburguer")) return "/products/burger_lendas.jpg";
  if (n.includes("batata") || n.includes("suprema")) return "/products/batata_suprema.jpg";
  if (n.includes("carne de sol") || n.includes("file") || n.includes("frango a passarinho")) return "/products/carne_sol.jpg";
  if (n.includes("espetinho") || cat.includes("espetinho")) return "/products/espetinho_carne.jpg";
  if (n.includes("pastel") || n.includes("calabresa") || n.includes("torresmo") || n.includes("tripinha") || n.includes("manjubinha") || n.includes("caldo")) return "/products/pastel_petisco.jpg";
  if (cat.includes("caipirinha")) return "/products/caipirinha_limao.jpg";
  if (cat.includes("coquetel") || cat.includes("batida") || cat.includes("drink") || n.includes("coco blue") || n.includes("margarita") || n.includes("afrodite")) return "/products/coquetel_tropical.jpg";
  if (cat.includes("cerveja") || n.includes("cerveja") || n.includes("skol") || n.includes("brahma") || n.includes("heineken") || n.includes("amstel")) return "/products/cerveja_gelada.jpg";
  if (cat.includes("destilado") || cat.includes("combo")) return "/products/coquetel_tropical.jpg";
  if (cat.includes("porco") || cat.includes("petisco")) return "/products/pastel_petisco.jpg";
  return "/products/burger_lendas.jpg";
}

function toClientProduct(product: ProductRecord) {
  return {
    id: product.id,
    name: product.name,
    desc: product.description,
    description: product.description,
    imageUrl: product.imageUrl || getProductMockImage(product.name, product.category?.name),
    price: product.priceCents / 100,
    isFeatured: product.isFeatured ?? false,
    isPromo: product.isPromo ?? false,
    promoPrice: product.promoPriceCents ? product.promoPriceCents / 100 : null,
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
  try {
    const db = getDb() as unknown as ProductsDb;
    const restaurant = await getRestaurant(db);
    const products = await db.product.findMany({
      where: { restaurantId: restaurant.id, active: true },
      orderBy: { createdAt: "asc" },
      include: { category: { select: { name: true } } }
    });

    if (products.length > 0) {
      return NextResponse.json(
        { products: products.map(toClientProduct) },
        { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
      );
    }
  } catch (err) {
    console.warn("[api/products] Banco indisponível, usando memoryStore:", err);
  }

  // Fallback resiliente usando memoryStore
  return NextResponse.json(
    {
      products: memoryStore.products.filter((p) => p.active).map((p) => ({
        id: p.id,
        name: p.name,
        desc: p.desc,
        description: p.desc,
        imageUrl: p.imageUrl || getProductMockImage(p.name, p.category),
        price: p.price,
        isFeatured: p.isFeatured ?? false,
        isPromo: p.isPromo ?? false,
        promoPrice: p.promoPrice ?? null,
        category: p.category,
        active: p.active,
        tone: p.tone || "from-red-700/30 to-zinc-950"
      }))
    },
    { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
  );
}

export async function POST(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    imageUrl?: string;
    isFeatured?: boolean;
    isPromo?: boolean;
    promoPrice?: number;
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
      priceCents: Math.round(Number(body.price) * 100),
      isFeatured: Boolean(body.isFeatured),
      isPromo: Boolean(body.isPromo),
      promoPriceCents: body.promoPrice ? Math.round(Number(body.promoPrice) * 100) : null
    },
    include: { category: { select: { name: true } } }
  });

  return NextResponse.json({ product: toClientProduct(product) });
}
