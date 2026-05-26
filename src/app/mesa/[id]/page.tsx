import { cookies } from "next/headers";
import { CustomerApp } from "@/components/lendas/customer-app";

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const initialName = cookieStore.get(`lendas_mesa_${id}_name`)?.value ?? "";

  return <CustomerApp tableId={id} initialName={initialName} />;
}
