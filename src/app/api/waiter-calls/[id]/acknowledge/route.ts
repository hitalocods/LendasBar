import { NextResponse } from "next/server";
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
