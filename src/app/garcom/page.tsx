import { redirect } from "next/navigation";
import { WaiterTables } from "@/components/waiter/waiter-tables";
import { getStaffSession, hasRoleAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const session = await getStaffSession();

  if (!session || !hasRoleAccess(session.role, "WAITER")) {
    redirect("/login?next=/garcom");
  }

  return <WaiterTables waiterName={session.name} />;
}
