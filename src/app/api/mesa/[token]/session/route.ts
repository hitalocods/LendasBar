import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type TableSessionRecord = {
  id: string;
};

type TableRecord = {
  id: string;
  restaurantId: string;
  currentSessionId: string | null;
  currentSession: TableSessionRecord | null;
};

type SessionRouteDb = {
  table: {
    findUnique: (args: unknown) => Promise<TableRecord | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    create: (args: unknown) => Promise<TableSessionRecord>;
  };
  tableSessionUser: {
    upsert: (args: unknown) => Promise<{
      id: string;
      name: string;
      clientId: string;
    }>;
    findMany: (args: unknown) => Promise<Array<{ id: string; name: string; active: boolean }>>;
  };
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; clientId?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      table: { token, number: token },
      session: { id: `demo_session_${token}`, status: "ACTIVE" },
      user: { name, clientId: body.clientId ?? "demo-client" }
    });
  }

  const db = getDb() as unknown as SessionRouteDb;
  const table = await db.table.findUnique({ where: { qrToken: token }, include: { currentSession: true } });

  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const session =
    table.currentSession ??
    (await db.tableSession.create({
      data: {
        restaurantId: table.restaurantId,
        tableId: table.id
      }
    }));

  if (!table.currentSessionId) {
    await db.table.update({
      where: { id: table.id },
      data: { currentSessionId: session.id, status: "OCCUPIED" }
    });
  }

  const user = await db.tableSessionUser.upsert({
    where: {
      sessionId_clientId: {
        sessionId: session.id,
        clientId: body.clientId ?? name
      }
    },
    create: {
      sessionId: session.id,
      clientId: body.clientId ?? name,
      name
    },
    update: {
      name,
      active: true
    }
  });

  const users = await db.tableSessionUser.findMany({
    where: { sessionId: session.id, active: true },
    select: { id: true, name: true, active: true },
    orderBy: { joinedAt: "asc" }
  });

  return NextResponse.json({ table, session, user, users });
}
