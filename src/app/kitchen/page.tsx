import { redirect } from "next/navigation";
import { KitchenDashboard } from "@/components/lendas/kitchen-dashboard";
import { hasStaffAccess } from "@/lib/auth";

export default async function KitchenPage() {
  if (!(await hasStaffAccess("KITCHEN"))) {
    redirect("/login?next=/kitchen");
  }

  return <KitchenDashboard />;
}
