"use client";

import Image from "next/image";
import { ChefHat, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { OrderStatus, useLendasStore } from "@/store/lendas-store";

const statusStyles: Record<OrderStatus, string> = {
  Pendente: "border-red-500/30 bg-red-500/10 text-red-100",
  Confirmado: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  "Em preparo": "border-amber-500/30 bg-amber-500/10 text-amber-100",
  Pronto: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  Entregue: "border-zinc-500/30 bg-zinc-500/10 text-zinc-200"
};

export function KitchenDashboard() {
  const { orders: demoOrders, advanceOrder: advanceDemoOrder } = useLendasStore();
  const [orders, setOrders] = useState(demoOrders);
  const columns: OrderStatus[] = ["Pendente", "Confirmado", "Em preparo", "Pronto", "Entregue"];

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as { orders?: typeof orders };
    if (data.orders?.length) {
      setOrders(data.orders);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(loadOrders, 0);
    const interval = window.setInterval(loadOrders, 2500);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  async function advanceOrder(id: string) {
    const response = await fetch(`/api/orders/${id}/advance`, {
      method: "POST"
    });

    if (response.ok) {
      await loadOrders();
      return;
    }

    advanceDemoOrder(id);
  }

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-lg border border-white/10 bg-black/35 shadow-[0_30px_100px_rgba(0,0,0,0.55)] lg:grid-cols-[124px_1fr]">
        <aside className="hidden border-r border-white/10 bg-zinc-950/90 p-4 lg:block">
          <div className="relative mx-auto mb-8 h-16 w-16 overflow-hidden rounded-full border border-red-500/40">
            <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
          </div>
          <div className="space-y-2 text-xs text-zinc-400">
            {["Pedidos", "Historico", "Cardapio", "Mesas"].map((item, index) => (
              <div key={item} className={cn("rounded-md px-3 py-2", index === 0 && "bg-red-600 text-white")}>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <section className="p-4 lg:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Painel da cozinha</p>
              <h1 className="text-2xl font-semibold">Fila de preparo realtime</h1>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              <ChefHat className="h-4 w-4" />
              Operacao ao vivo
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((status) => (
              <div key={status} className="min-h-[70vh] rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{status}</span>
                  <Badge className={statusStyles[status]}>{orders.filter((order) => order.status === status).length}</Badge>
                </div>
                <div className="space-y-3">
                  {orders
                    .filter((order) => order.status === status)
                    .map((order) => (
                      <Card key={order.id} className="border-white/10 bg-zinc-950/80 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{order.table}</p>
                            <p className="text-xs text-red-200">{order.guest}</p>
                          </div>
                          <span className="font-mono text-xs text-zinc-500">{order.id}</span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-zinc-300">
                          {order.items.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {order.minutes} min
                          </span>
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                        {order.status !== "Entregue" && (
                          <Button size="sm" className="mt-3 w-full" onClick={() => advanceOrder(order.id)}>
                            Avancar status
                          </Button>
                        )}
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
