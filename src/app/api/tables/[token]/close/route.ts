import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

type CloseTableDb = {
  table: {
    findUnique: (args: unknown) => Promise<null | { id: string; currentSessionId: string | null }>;
    update: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    update: (args: unknown) => Promise<unknown>;
  };
  waiterCall: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { token } = await params;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", table: token, status: "AVAILABLE" });
  }

  const db = getDb() as unknown as CloseTableDb;
  const table = await db.table.findUnique({
    where: { qrToken: token },
    select: { id: true, currentSessionId: true }
  });

  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  if (table.currentSessionId) {
    await db.tableSession.update({
      where: { id: table.currentSessionId },
      data: { status: "CLOSED", closedAt: new Date() }
    });
    await db.waiterCall.updateMany({
      where: { sessionId: table.currentSessionId, status: { not: "RESOLVED" } },
      data: { status: "RESOLVED", resolvedAt: new Date() }
    });
  }

  await db.table.update({
    where: { id: table.id },
    data: {
      currentSessionId: null,
      status: "AVAILABLE"
    }
  });

  return NextResponse.json({ table: token, status: "AVAILABLE" });
}
