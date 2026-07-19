import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type RestaurantDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      accent: string;
      background: string;
      settings: Record<string, unknown>;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      settings: {
        name: "LENDAS 2018",
        accent: "#d71920",
        background: "#050505",
        logoUrl: "/lendas-logo.png",
        businessHours: "18:00 - 02:00",
        phone: "(86) 99999-9999"
      }
    });
  }

  try {
    const db = getDb() as unknown as RestaurantDb;
    const restaurant = await db.restaurant.findFirst({
      where: { slug: "lendas-2018" }
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const settingsObj = (restaurant.settings || {}) as Record<string, unknown>;

    return NextResponse.json(
      {
        settings: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logoUrl ?? "/lendas-logo.png",
          accent: restaurant.accent,
          background: restaurant.background,
          businessHours: (settingsObj.businessHours as string) ?? "18:00 - 02:00",
          phone: (settingsObj.phone as string) ?? ""
        }
      },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
    );
  } catch {
    return NextResponse.json({
      settings: {
        name: "LENDAS 2018",
        accent: "#d71920",
        background: "#050505",
        logoUrl: "/lendas-logo.png"
      }
    });
  }
}

export async function PATCH(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    accent?: string;
    background?: string;
    logoUrl?: string;
    businessHours?: string;
    phone?: string;
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, settings: body });
  }

  const db = getDb() as unknown as RestaurantDb;
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" }
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const currentSettings = (restaurant.settings || {}) as Record<string, unknown>;

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.accent ? { accent: body.accent.trim() } : {}),
      ...(body.background ? { background: body.background.trim() } : {}),
      ...(typeof body.logoUrl === "string" ? { logoUrl: body.logoUrl.trim() || null } : {}),
      settings: {
        ...currentSettings,
        ...(typeof body.businessHours === "string" ? { businessHours: body.businessHours.trim() } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone.trim() } : {})
      }
    }
  });

  return NextResponse.json({ ok: true });
}
