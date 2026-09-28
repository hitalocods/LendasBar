import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Confirmação de Eventos (Acknowledgment)
 * Padrão Open Delivery / Programa Consumer
 */
export async function POST(request: Request) {
  try {
    return NextResponse.json({
      statusCode: 0,
      reasonPhrase: null
    });
  } catch {
    return NextResponse.json({ statusCode: 0, reasonPhrase: null });
  }
}
