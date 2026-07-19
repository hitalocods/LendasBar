import { NextResponse } from "next/server";
import { hasStaffAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type OrderItem = {
  productName: string;
  quantity: number;
  unitCents: number;
};

type OrderRecord = {
  id: string;
  customerName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  table: { number: number };
  items: OrderItem[];
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado"
};

export async function GET(request: Request) {
  if (!(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const statusParam = searchParams.get("status");
  const tableParam = searchParams.get("table");
  const search = searchParams.get("q")?.trim().toLowerCase();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ orders: [], total: 0 });
  }

  try {
    const db = getDb() as unknown as {
      order: {
        findMany: (args: unknown) => Promise<OrderRecord[]>;
      };
    };

    const where: Record<string, unknown> = {};

    if (fromParam || toParam) {
      where.createdAt = {
        ...(fromParam ? { gte: new Date(fromParam) } : {}),
        ...(toParam ? { lte: new Date(toParam) } : {})
      };
    }

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    if (tableParam) {
      const num = Number(tableParam);
      if (Number.isFinite(num)) {
        where.table = { number: num };
      }
    }

    const rawOrders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        table: { select: { number: true } },
        items: { select: { productName: true, quantity: true, unitCents: true } }
      }
    });

    let filtered = rawOrders.map((order) => {
      const totalCents = order.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
      return {
        id: order.id,
        table: `Mesa ${order.table.number}`,
        tableNumber: order.table.number,
        customerName: order.customerName,
        status: order.status,
        statusLabel: statusLabel[order.status] ?? order.status,
        items: order.items.map((item) => `${item.quantity}x ${item.productName}`),
        total: totalCents / 100,
        createdAt: order.createdAt.toISOString()
      };
    });

    if (search) {
      filtered = filtered.filter(
        (o) =>
          o.customerName.toLowerCase().includes(search) ||
          o.table.toLowerCase().includes(search) ||
          o.id.toLowerCase().includes(search) ||
          o.items.some((i) => i.toLowerCase().includes(search))
      );
    }

    return NextResponse.json(
      { orders: filtered, total: filtered.length },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
    );
  } catch {
    return NextResponse.json({ orders: [], total: 0 });
  }
}
