import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type ResolveCallDb = {
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
    return NextResponse.json({ mode: "demo", call: { id, status: "RESOLVED" } });
  }

  const db = getDb() as unknown as ResolveCallDb;
  const call = await db.waiterCall.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date()
    }
  });

  return NextResponse.json({ call });
}
