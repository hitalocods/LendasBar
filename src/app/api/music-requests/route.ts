import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type MusicRequestPayload = {
  restaurantId?: string;
  tableId?: string;
  tableToken?: string;
  sessionId?: string;
  customerName: string;
  title: string;
  artist?: string;
  notes?: string;
};

type MusicRequestsDb = {
  restaurant: {
    findFirst: (args?: unknown) => Promise<{ id: string } | null>;
  };
  musicRequest: {
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      customerName: string;
      title: string;
      artist: string | null;
      notes: string | null;
      status: string;
      createdAt: Date;
      playedAt: Date | null;
      table: { number: number };
    }>>;
    create: (args: unknown) => Promise<unknown>;
  };
  table: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      restaurantId: string;
      currentSessionId: string | null;
      currentSession: { id: string } | null;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  tableSession: {
    create: (args: unknown) => Promise<{ id: string }>;
  };
};

async function getRestaurant(db: MusicRequestsDb) {
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  return restaurant;
}

export async function GET() {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ requests: [] });
  }

  const db = getDb() as unknown as MusicRequestsDb;
  const restaurant = await getRestaurant(db);
  const requests = await db.musicRequest.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { table: { select: { number: true } } }
  });

  return NextResponse.json({
    requests: requests.map((request) => ({
      id: request.id,
      table: `Mesa ${request.table.number}`,
      customerName: request.customerName,
      title: request.title,
      artist: request.artist,
      notes: request.notes,
      status: request.status,
      createdAt: request.createdAt,
      playedAt: request.playedAt
    }))
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as MusicRequestPayload;

  if (!payload.customerName?.trim() || !payload.title?.trim()) {
    return NextResponse.json({ error: "Music request requires customer and title" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      mode: "demo",
      musicRequest: {
        id: `demo_music_${Date.now()}`,
        status: "OPEN",
        ...payload
      }
    });
  }

  const db = getDb() as unknown as MusicRequestsDb;
  let restaurantId = payload.restaurantId;
  let tableId = payload.tableId;
  let sessionId = payload.sessionId;

  if (payload.tableToken) {
    const table = await db.table.findUnique({
      where: { qrToken: payload.tableToken },
      include: { currentSession: true }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    restaurantId = table.restaurantId;
    tableId = table.id;
    sessionId =
      table.currentSession?.id ??
      (
        await db.tableSession.create({
          data: {
            restaurantId: table.restaurantId,
            tableId: table.id
          }
        })
      ).id;

    if (!table.currentSessionId) {
      await db.table.update({
        where: { id: table.id },
        data: {
          currentSessionId: sessionId,
          status: "OCCUPIED"
        }
      });
    }
  }

  if (!restaurantId || !tableId || !sessionId) {
    return NextResponse.json({ error: "Music request requires table/session context" }, { status: 400 });
  }

  const musicRequest = await db.musicRequest.create({
    data: {
      restaurantId,
      tableId,
      sessionId,
      customerName: payload.customerName.trim(),
      title: payload.title.trim(),
      artist: payload.artist?.trim() || null,
      notes: payload.notes?.trim() || null
    }
  });

  return NextResponse.json({ musicRequest });
}