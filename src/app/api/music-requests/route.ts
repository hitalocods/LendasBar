import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

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

  try {
    const db = getDb() as unknown as MusicRequestsDb;
    const restaurant = await getRestaurant(db);
    const requests = await db.musicRequest.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { table: { select: { number: true } } }
    });

    if (requests.length > 0 || memoryStore.musicRequests.length === 0) {
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
  } catch (err) {
    console.warn("[api/music-requests] Banco indisponível, usando memoryStore:", err);
  }

  return NextResponse.json({
    requests: memoryStore.musicRequests.map((r) => ({
      id: r.id,
      table: `Mesa ${r.tableToken}`,
      customerName: r.customerName,
      title: r.title,
      artist: r.artist,
      notes: r.notes,
      status: r.played ? "PLAYED" : "OPEN",
      createdAt: r.createdAt,
      playedAt: r.played ? r.createdAt : null
    }))
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as MusicRequestPayload;

  if (!payload.customerName?.trim() || !payload.title?.trim()) {
    return NextResponse.json({ error: "Music request requires customer and title" }, { status: 400 });
  }

  // Registra no memoryStore
  const memReq = memoryStore.addMusicRequest(
    payload.tableToken || "1",
    payload.customerName,
    payload.title,
    payload.artist,
    payload.notes
  );

  try {
    const db = getDb() as unknown as MusicRequestsDb;
    let restaurantId = payload.restaurantId;
    let tableId = payload.tableId;
    let sessionId = payload.sessionId;

    if (payload.tableToken) {
      const table = await db.table.findUnique({
        where: { qrToken: payload.tableToken },
        include: { currentSession: true }
      });

      if (table) {
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

        await db.table.update({
          where: { id: table.id },
          data: {
            currentSessionId: sessionId,
            status: "OCCUPIED"
          }
        });
      }
    }

    if (restaurantId && tableId && sessionId) {
      const musicRequest = await db.musicRequest.create({
        data: {
          restaurantId,
          tableId,
          sessionId,
          customerName: payload.customerName,
          title: payload.title,
          artist: payload.artist,
          notes: payload.notes
        }
      });

      return NextResponse.json({ musicRequest });
    }
  } catch (err) {
    console.warn("[api/music-requests POST] Banco indisponível, registrado no memoryStore:", err);
  }

  return NextResponse.json({ musicRequest: memReq });
}