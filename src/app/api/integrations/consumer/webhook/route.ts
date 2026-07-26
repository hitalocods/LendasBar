import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

/**
 * Webhook Receptor oficial do Programa Consumer para atualizar o status em tempo real.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, id_externo, consumer_id, fullCode, code, status } = body as {
      orderId?: string;
      id_externo?: string;
      consumer_id?: string;
      fullCode?: string;
      code?: string;
      status?: string;
    };

    const targetOrderId = orderId || id_externo;

    if (!targetOrderId && !consumer_id) {
      return NextResponse.json({ error: "Missing order identifiers (orderId or consumer_id)" }, { status: 400 });
    }

    const db = getDb();

    // Busca o pedido no banco do Lendas pelo ID interno ou ID do Consumer
    const order = await db.order.findFirst({
      where: {
        OR: [
          targetOrderId ? { id: targetOrderId } : {},
          consumer_id ? { consumerOrderId: consumer_id } : {}
        ]
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let nextStatus: OrderStatus = order.status;
    const statusCodeStr = (fullCode || code || status || "").toUpperCase();

    if (statusCodeStr.includes("CONFIRM") || statusCodeStr.includes("CFM") || statusCodeStr.includes("ACEITO")) {
      nextStatus = OrderStatus.CONFIRMED;
    } else if (statusCodeStr.includes("PREPAR") || statusCodeStr.includes("PRP") || statusCodeStr.includes("PRODUC")) {
      nextStatus = OrderStatus.PREPARING;
    } else if (statusCodeStr.includes("READY") || statusCodeStr.includes("RDY") || statusCodeStr.includes("PRONTO")) {
      nextStatus = OrderStatus.READY;
    } else if (statusCodeStr.includes("DELIVER") || statusCodeStr.includes("DLV") || statusCodeStr.includes("ENTREGUE")) {
      nextStatus = OrderStatus.DELIVERED;
    } else if (statusCodeStr.includes("CANCEL") || statusCodeStr.includes("CAN")) {
      nextStatus = OrderStatus.CANCELLED;
    }

    const updatedOrder = await db.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        consumerOrderId: consumer_id || order.consumerOrderId,
        syncStatus: "SYNCED",
        syncedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      syncStatus: updatedOrder.syncStatus
    });
  } catch (error) {
    console.error("[Consumer Webhook Error]:", error);
    return NextResponse.json({ error: "Internal webhook error" }, { status: 500 });
  }
}
