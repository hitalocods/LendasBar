import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: true, mode: "demo" });
  }

  const db = getDb();
  await db.waiterCall.update({
    where: { id },
    data: { status: "RESOLVED" }
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
