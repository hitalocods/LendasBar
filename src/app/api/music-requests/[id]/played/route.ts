import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

type PlayMusicRequestDb = {
  musicRequest: {
    update: (args: unknown) => Promise<unknown>;
  };
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  memoryStore.markMusicPlayed(id);

  try {
    const db = getDb() as unknown as PlayMusicRequestDb;
    const musicRequest = await db.musicRequest.update({
      where: { id },
      data: {
        status: "PLAYED",
        playedAt: new Date()
      }
    });

    return NextResponse.json({ musicRequest });
  } catch (err) {
    console.warn("[api/music-requests/played] Banco indisponível, marcado no memoryStore:", err);
  }

  return NextResponse.json({ mode: "demo", musicRequest: { id, status: "PLAYED" } });
}
