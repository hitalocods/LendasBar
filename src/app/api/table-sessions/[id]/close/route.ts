import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type CloseSessionRouteDb = {
  tableSession: {
    update: (args: unknown) => Promise<unknown>;
  };
  table: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      session: { id, status: "CLOSED" }
    });
  }

  const db = getDb() as unknown as CloseSessionRouteDb;
  const session = await db.tableSession.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date()
    }
  });

  await db.table.updateMany({
    where: { currentSessionId: id },
    data: {
      currentSessionId: null,
      status: "AVAILABLE"
    }
  });

  return NextResponse.json({ session });
}
