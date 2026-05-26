"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { BarChart3, Boxes, Grid2X2, ReceiptText, Settings, ShoppingBag, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { useLendasStore } from "@/store/lendas-store";

export function AdminPanel() {
  const { orders, waiterCalls, billRequests } = useLendasStore();
  const activeOrders = orders.filter((order) => order.status !== "Entregue").length;
  const revenue = orders.reduce((total, order) => total + order.total, 0);

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-white/10 bg-black/55 p-4">
          <div className="mb-8 flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-red-500/40">
              <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold">LENDAS 2018</p>
              <p className="text-xs text-zinc-500">Proprietario</p>
            </div>
          </div>
          <nav className="space-y-1 text-sm text-zinc-400">
            {[
              [BarChart3, "Dashboard"],
              [Boxes, "Cardapio"],
              [Grid2X2, "Categorias"],
              [Users, "Mesas"],
              [ReceiptText, "Pedidos"],
              [Settings, "Configuracoes"]
            ].map(([Icon, label], index) => (
              <div key={label as string} className={cn("flex items-center gap-2 rounded-md px-3 py-2", index === 0 && "bg-red-600 text-white")}>
                <Icon className="h-4 w-4" />
                {label as string}
              </div>
            ))}
          </nav>
        </aside>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Painel administrativo</p>
              <h1 className="text-2xl font-semibold">Gestao do restaurante</h1>
            </div>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">Aberto agora</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={ShoppingBag} label="Pedidos ativos" value={String(activeOrders)} />
            <Metric icon={WalletCards} label="Faturamento hoje" value={formatCurrency(revenue)} />
            <Metric icon={Users} label="Chamados" value={String(waiterCalls)} />
            <Metric icon={ReceiptText} label="Contas solicitadas" value={String(billRequests)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Card className="border-white/10 bg-black/45 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Mesas</h2>
                <Button variant="secondary" size="sm">Ver todas</Button>
              </div>
              <div className="space-y-2">
                {["Mesa 01", "Mesa 02", "Mesa 03", "Mesa 12", "Mesa 18"].map((table, index) => (
                  <div key={table} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.035] px-3 py-3 text-sm">
                    <span>{table}</span>
                    <span className={cn("text-xs", index === 3 ? "text-amber-300" : "text-emerald-300")}>
                      {index === 3 ? "Aguardando conta" : "Aberta"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-black/45 p-4">
              <h2 className="mb-1 text-lg font-semibold">Gerar QR Code</h2>
              <p className="mb-4 text-sm text-zinc-500">Selecione a mesa e imprima o acesso do cliente.</p>
              <div className="mb-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-3 text-sm">Mesa 12</div>
              <div className="grid place-items-center rounded-md bg-white p-4">
                <QRCodeSVG value="https://lendas2018.app/mesa/12" size={180} />
              </div>
              <Button className="mt-4 w-full">Imprimir QR Code</Button>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.045] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-300">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
