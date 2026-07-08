import { redirect } from "next/navigation";
import { WaiterPanel } from "@/components/lendas/waiter-panel";
import { hasStaffAccess } from "@/lib/auth";

export default async function WaiterPage() {
  if (!(await hasStaffAccess("WAITER"))) {
    redirect("/login?next=/waiter");
  }

  return <WaiterPanel />;
}
