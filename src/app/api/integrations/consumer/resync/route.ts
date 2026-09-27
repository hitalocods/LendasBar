import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendOrderToConsumer } from "@/lib/consumer-api";
import { hasStaffAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const MAX_SYNC_ATTEMPTS = 5;

/**
 * Re-sincroniza atomicamente os pedidos pendentes com o Programa Consumer
 */
export async function executeAtomicResync(targetOrderId?: string) {
  if (!process.env.DATABASE_URL) {
    return { pendingTotal: 0, resyncedCount: 0, permanentFailures: 0, success: true };
  }

  const db = getDb();

  // 1. Buscar candidatos pendentes/falhos com menos de 5 tentativas
  const candidates = await db.order.findMany({
    where: targetOrderId
      ? { id: targetOrderId }
      : {
          syncStatus: { in: ["PENDING", "FAILED"] },
          syncAttempts: { lt: MAX_SYNC_ATTEMPTS }
        },
    include: {
      table: { select: { number: true } },
      items: {
        include: {
          product: { select: { consumerCode: true } }
        }
      }
    },
    take: targetOrderId ? 1 : 50,
    orderBy: { createdAt: "desc" }
  });

  let resyncedCount = 0;
  let permanentFailures = 0;

  for (const order of candidates) {
    // 2. Trava Atômica Condicional em Nível de Linha (UPDATE ... WHERE ... RETURNING)
    const lockedRows = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE "Order"
      SET "syncStatus" = 'PROCESSING', "updatedAt" = NOW()
      WHERE "id" = ${order.id}
        AND "syncStatus" IN ('PENDING', 'FAILED')
        AND "syncAttempts" < ${MAX_SYNC_ATTEMPTS}
      RETURNING "id"
    `;

    // Se 0 linhas foram afetadas, outra thread (Cron ou Botão) acabou de pegar este pedido. Pula!
    if (!lockedRows || lockedRows.length === 0) {
      continue;
    }

    // 3. Executar o envio externo pro Consumer
    const attempts = order.syncAttempts + 1;
    const result = await sendOrderToConsumer({
      id: order.id,
      restaurantId: order.restaurantId,
      customerName: order.customerName,
      tableNumber: order.table.number,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productCode: item.product?.consumerCode || null,
        quantity: item.quantity,
        unitCents: item.unitCents,
        notes: item.notes
      }))
    });

    // 4. Atualizar o status final de forma atômica
    if (result.success) {
      await db.order.update({
        where: { id: order.id },
        data: {
          consumerOrderId: result.consumerOrderId,
          syncStatus: "SYNCED",
          syncAttempts: attempts,
          syncedAt: new Date()
        }
      });
      resyncedCount += 1;
    } else {
      const isPermanent = attempts >= MAX_SYNC_ATTEMPTS;
      const finalStatus = isPermanent ? "SYNC_FAILED_PERMANENT" : "FAILED";

      await db.order.update({
        where: { id: order.id },
        data: {
          syncStatus: finalStatus,
          syncAttempts: attempts
        }
      });

      if (isPermanent) {
        permanentFailures += 1;
      }
    }
  }

  return {
    pendingTotal: candidates.length,
    resyncedCount,
    permanentFailures,
    success: true
  };
}

/**
 * Endpoint manual do Painel Admin para re-sincronizar
 */
export async function POST(request: Request) {
  const isInternal = request.headers.get("x-internal-call") === "true";
  if (!isInternal && !(await hasStaffAccess("MANAGER"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  const result = await executeAtomicResync(body.orderId);
  return NextResponse.json(result);
}

/**
 * Consulta a quantidade de pedidos pendentes e falhas permanentes
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ pendingCount: 0, permanentCount: 0 });
  }

  const db = getDb();
  const pendingCount = await db.order.count({
    where: {
      syncStatus: { in: ["PENDING", "FAILED"] },
      syncAttempts: { lt: MAX_SYNC_ATTEMPTS }
    }
  });

  const permanentCount = await db.order.count({
    where: { syncStatus: "SYNC_FAILED_PERMANENT" }
  });

  return NextResponse.json({ pendingCount, permanentCount });
}
