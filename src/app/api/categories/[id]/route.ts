import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { name?: string; sortOrder?: number; active?: boolean };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb() as unknown as {
    category: {
      update: (args: unknown) => Promise<unknown>;
    };
  };

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (typeof body.sortOrder === "number") {
    updateData.sortOrder = body.sortOrder;
  }
  if (typeof body.active === "boolean") {
    updateData.active = body.active;
  }

  await db.category.update({
    where: { id },
    data: updateData
  });

  return NextResponse.json({ ok: true });
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
    return NextResponse.json({ ok: true });
  }

  const db = getDb() as unknown as {
    category: {
      update: (args: unknown) => Promise<unknown>;
    };
  };

  await db.category.update({
    where: { id },
    data: { active: false }
  });

  return NextResponse.json({ ok: true });
}
