import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { memoryStore } from "@/lib/memory-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasStaffAccess("WAITER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  memoryStore.resolveWaiterCall(id);

  try {
    const db = getDb();
    await db.waiterCall.update({
      where: { id },
      data: { status: "RESOLVED" }
    });
  } catch (err) {
    console.warn("[api/waiter-calls/resolve] Banco indisponível, resolvido em memória:", err);
  }

  return NextResponse.json({ success: true });
}
