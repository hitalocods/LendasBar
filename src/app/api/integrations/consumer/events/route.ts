import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Polling da API Oficial de Parceiros do Consumer
 * O software Consumer no caixa faz GET periódicos para checar novos eventos de pedidos.
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      items: [],
      statusCode: 0,
      reasonPhrase: null
    });
  }

  const db = getDb();
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  if (!restaurant) {
    return NextResponse.json({ items: [], statusCode: 0, reasonPhrase: null });
  }

  // Busca pedidos criados recentemente que estejam pendentes de sincronização
  const pendingOrders = await db.order.findMany({
    where: {
      restaurantId: restaurant.id,
      syncStatus: "PENDING"
    },
    orderBy: { createdAt: "asc" },
    take: 10
  });

  const items = pendingOrders.map((order) => {
    let fullCode: "PLACED" | "CONFIRMED" | "PREPARING" | "READY" | "CANCELLED" = "PLACED";
    let code: "PLC" | "CFM" | "PRP" | "RDY" | "CAN" = "PLC";

    if (order.status === "CONFIRMED") {
      fullCode = "CONFIRMED";
      code = "CFM";
    } else if (order.status === "PREPARING") {
      fullCode = "PREPARING";
      code = "PRP";
    } else if (order.status === "READY") {
      fullCode = "READY";
      code = "RDY";
    } else if (order.status === "CANCELLED") {
      fullCode = "CANCELLED";
      code = "CAN";
    }

    return {
      id: `evt_${order.id}`,
      orderId: order.id,
      createdAt: order.createdAt.toISOString(),
      fullCode,
      code
    };
  });

  return NextResponse.json({
    items,
    statusCode: 0,
    reasonPhrase: null
  });
}
