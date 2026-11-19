import { redirect } from "next/navigation";
import { CustomerApp } from "@/components/lendas/customer-app";
import { getStaffSession, hasRoleAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WaiterTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getStaffSession();

  if (!session || !hasRoleAccess(session.role, "WAITER")) {
    redirect(`/login?next=${encodeURIComponent(`/garcom/mesa/${id}`)}`);
  }

  // Mesmo fluxo do QR code, mas o garçom escolhe o cliente e envia o pedido por ele.
  return <CustomerApp tableId={id} initialName="" waiterName={session.name} />;
}
