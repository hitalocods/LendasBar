import { CustomerApp } from "@/components/lendas/customer-app";

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <CustomerApp tableId={id} />;
}
