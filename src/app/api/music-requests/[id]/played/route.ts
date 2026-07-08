import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ mode: "demo", musicRequest: { id, status: "PLAYED" } });
  }

  const db = getDb() as unknown as PlayMusicRequestDb;
  const musicRequest = await db.musicRequest.update({
    where: { id },
    data: {
      status: "PLAYED",
      playedAt: new Date()
    }
  });

  return NextResponse.json({ musicRequest });
}