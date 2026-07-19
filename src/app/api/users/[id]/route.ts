import { NextResponse } from "next/server";
import { hashPassword, hasStaffAccess, StaffRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

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
    email?: string;
    role?: StaffRole;
    password?: string;
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb() as unknown as {
    user: {
      update: (args: unknown) => Promise<unknown>;
    };
  };

  const data: Record<string, unknown> = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.email?.trim()) data.email = body.email.trim().toLowerCase();
  if (body.role) data.role = body.role;
  if (body.password) data.passwordHash = hashPassword(body.password);

  await db.user.update({
    where: { id },
    data
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
    user: {
      delete: (args: unknown) => Promise<unknown>;
    };
  };

  await db.user.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
