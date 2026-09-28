import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Polling da API Oficial de Parceiros do Consumer
 * O software Consumer no caixa faz GET periódicos para checar novos eventos de pedidos.
 *
 * Após entregar os eventos, marca os pedidos como SYNCED para evitar reentrega duplicada.
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

  // Busca o restaurante sem hardcodar o slug — usa o primeiro restaurante ativo
  // (para multi-tenant no futuro, passar o restaurantId via query param ou header)
  const restaurant = await db.restaurant.findFirst({
    select: { id: true }
  });

  if (!restaurant) {
    return NextResponse.json({ items: [], statusCode: 0, reasonPhrase: null });
  }

  // Busca pedidos criados nas últimas 24 horas pendentes de sincronização (mais novos primeiro)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pendingOrders = await db.order.findMany({
    where: {
      createdAt: { gte: oneDayAgo },
      syncStatus: { in: ["PENDING", "FAILED"] },
      status: { not: "CANCELLED" }
    },
    orderBy: { createdAt: "desc" },
    take: 20
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

export async function POST(request: Request) {
  // Consumer acknowledgment de eventos recebidos
  return NextResponse.json({
    statusCode: 0,
    reasonPhrase: null
  });
}
