"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChefHat, Clock, Play, RotateCcw, Utensils, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { playChime } from "@/lib/chime";

type Order = {
  id: string;
  table: string;
  guest: string;
  items: string[];
  total: number;
  status: "Pendente" | "Confirmado" | "Em preparo" | "Pronto" | "Entregue" | "Cancelado";
  createdAt: string;
  minutes: number;
};

type Filter = "all" | "pending" | "preparing" | "ready" | "delivered";

export function KitchenOrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [soundOn, setSoundOn] = useState(true);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const incoming = (data.orders ?? []) as Order[];
        setOrders(incoming);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 4000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function advanceOrder(id: string) {
    setAdvancingId(id);
    try {
      const res = await fetch(`/api/orders/${id}/advance`, { method: "POST" });
      if (res.ok) {
        if (soundOn) playChime();
        await loadOrders();
      }
    } finally {
      setAdvancingId(null);
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === "pending") return order.status === "Pendente" || order.status === "Confirmado";
    if (filter === "preparing") return order.status === "Em preparo";
    if (filter === "ready") return order.status === "Pronto";
    if (filter === "delivered") return order.status === "Entregue";
    return true;
  });

  const countPending = orders.filter((o) => o.status === "Pendente" || o.status === "Confirmado").length;
  const countPreparing = orders.filter((o) => o.status === "Em preparo").length;
  const countReady = orders.filter((o) => o.status === "Pronto").length;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Controle de Som */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(
            [
              ["all", `Todos (${orders.length})`],
              ["pending", `Pendentes (${countPending})`],
              ["preparing", `Em Preparo (${countPreparing})`],
              ["ready", `Prontos (${countReady})`],
              ["delivered", "Entregues"]
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                filter === val
                  ? "border-red-500/60 bg-red-600 text-white"
                  : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10",
                val === "pending" && countPending > 0 && filter !== val && "border-red-500/50 text-red-400 animate-pulse",
                val === "ready" && countReady > 0 && filter !== val && "border-emerald-500/50 text-emerald-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSoundOn((s) => !s)}
            className="text-xs text-zinc-300 gap-1.5"
          >
            {soundOn ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
            {soundOn ? "Sons Ativos" : "Sem Som"}
          </Button>
          <Button size="sm" variant="outline" onClick={loadOrders} className="text-xs border-white/10 gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {loading && <p className="py-8 text-center text-xs text-zinc-500">Carregando fila de pedidos...</p>}

      {!loading && filteredOrders.length === 0 && (
        <Card className="border-white/10 bg-black/40 p-8 text-center">
          <ChefHat className="mx-auto mb-2 h-10 w-10 text-zinc-600" />
          <h3 className="text-sm font-bold text-white">Nenhum pedido nessa fila</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Os pedidos enviados pelas mesas ou garçons aparecerão aqui.</p>
        </Card>
      )}

      {/* Grid de Pedidos no estilo KDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filteredOrders.map((order) => {
          const isPending = order.status === "Pendente" || order.status === "Confirmado";
          const isPreparing = order.status === "Em preparo";
          const isReady = order.status === "Pronto";
          const isDelivered = order.status === "Entregue";

          const cardBorder = isReady
            ? "border-emerald-500/60 bg-gradient-to-b from-emerald-950/30 to-black/90 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            : isPreparing
              ? "border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-black/90"
              : isPending
                ? "border-red-500/60 bg-gradient-to-b from-red-950/30 to-black/90 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                : "border-white/10 bg-black/60 opacity-60";

          return (
            <Card key={order.id} className={cn("p-4 flex flex-col justify-between space-y-3", cardBorder)}>
              <div>
                {/* Header do Card: Mesa + Tempo + Status */}
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="text-lg font-black text-white">{order.table}</span>
                    <p className="text-xs text-zinc-300 font-medium">{order.guest}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        isReady
                          ? "bg-emerald-500 text-black font-black"
                          : isPreparing
                            ? "bg-amber-400 text-black font-black"
                            : isPending
                              ? "bg-red-600 text-white font-bold animate-pulse"
                              : "bg-zinc-700 text-zinc-300"
                      )}
                    >
                      {order.status}
                    </Badge>
                    <p className="text-[11px] text-zinc-400 mt-1 flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" /> há {order.minutes} min
                    </p>
                  </div>
                </div>

                {/* Lista de Itens do Pedido */}
                <div className="py-2.5 space-y-1.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-zinc-100">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rodapé: Total + Ação de Avançar Status */}
              <div className="border-t border-white/10 pt-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">Total</span>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(order.total)}</p>
                </div>

                {!isDelivered && (
                  <Button
                    size="sm"
                    disabled={advancingId === order.id}
                    className={cn(
                      "font-bold text-xs h-9 px-3 gap-1.5 shadow-md",
                      isPending && "bg-amber-500 hover:bg-amber-400 text-black",
                      isPreparing && "bg-emerald-600 hover:bg-emerald-500 text-white",
                      isReady && "bg-zinc-700 hover:bg-zinc-600 text-white"
                    )}
                    onClick={() => advanceOrder(order.id)}
                  >
                    {isPending && (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Iniciar Preparo
                      </>
                    )}
                    {isPreparing && (
                      <>
                        <ChefHat className="h-3.5 w-3.5" />
                        Marcar como Pronto
                      </>
                    )}
                    {isReady && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmar Entrega
                      </>
                    )}
                  </Button>
                )}

                {isDelivered && (
                  <Badge className="text-zinc-400 border border-white/10 bg-transparent text-xs">
                    ✓ Entregue na Mesa
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
