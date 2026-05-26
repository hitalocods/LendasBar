import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type AssignmentDb = {
  table: {
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = (await request.json()) as { waiterId?: string | null };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", table: { qrToken: token, assignedWaiterId: payload.waiterId ?? null } });
  }

  const db = getDb() as unknown as AssignmentDb;
  const table = await db.table.update({
    where: { qrToken: token },
    data: { assignedWaiterId: payload.waiterId || null }
  });

  return NextResponse.json({ table });
}
