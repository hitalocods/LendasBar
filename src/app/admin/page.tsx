import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/lendas/admin-panel";
import { hasStaffAccess } from "@/lib/auth";

export default async function AdminPage() {
  if (!(await hasStaffAccess())) {
    redirect("/login?next=/admin");
  }

  return <AdminPanel />;
}
