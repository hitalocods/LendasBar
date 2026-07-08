import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

type AcknowledgeCallDb = {
  waiterCall: {
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", call: { id, status: "ACKNOWLEDGED" } });
  }

  const db = getDb() as unknown as AcknowledgeCallDb;
  const call = await db.waiterCall.update({
    where: { id },
    data: { status: "ACKNOWLEDGED" }
  });

  return NextResponse.json({ call });
}
