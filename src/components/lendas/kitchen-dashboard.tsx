"use client";

import Image from "next/image";
import { ChefHat, Clock3, LogOut, Maximize2, Volume2, VolumeX, X, AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { OrderStatus, useLendasStore } from "@/store/lendas-store";
import { printTicket } from "@/lib/print-ticket";
import { menuItems } from "@/components/lendas/data";

type KitchenOrder = {
  id: string;
  table: string;
  guest: string;
  items: string[];
  total: number;
  status: OrderStatus;
  minutes: number;
  createdAt?: string;
};

const statusStyles: Record<OrderStatus, string> = {
  Pendente: "border-red-500/30 bg-red-500/10 text-red-100",
  Confirmado: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  "Em preparo": "border-amber-500/30 bg-amber-500/10 text-amber-100",
  Pronto: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  Entregue: "border-zinc-500/30 bg-zinc-500/10 text-zinc-200"
};

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playChimeSound() {
  try {
    const ctx = getSharedAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Ignore browser audio restrictions
  }
}

export function KitchenDashboard() {
  const { advanceOrder: advanceDemoOrder } = useLendasStore();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [selectedOrder, setSelectedOrderState] = useState<KitchenOrder | null>(null);
  const selectedOrderRef = useRef<KitchenOrder | null>(null);
  const [activeView, setActiveView] = useState<"pedidos" | "historico" | "cardapio" | "mesas">("pedidos");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const prevPendingCountRef = useRef<number | null>(null);
  const columns: OrderStatus[] = ["Pendente", "Confirmado", "Em preparo", "Pronto", "Entregue"];

  function handleSelectOrder(order: KitchenOrder | null) {
    selectedOrderRef.current = order;
    setSelectedOrderState(order);
  }

  function unlockAudio() {
    getSharedAudioCtx();
    setAudioUnlocked(true);
  }

  const isSameLocalDay = useCallback((isoDate?: string) => {
    if (!isoDate) return false;

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }, []);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as { orders?: KitchenOrder[] };
    if (data.orders) {
      setOrders(data.orders);

      if (selectedOrderRef.current) {
        const updated = data.orders.find((o) => o.id === selectedOrderRef.current?.id);
        if (updated && selectedOrderRef.current) {
          selectedOrderRef.current = updated;
          setSelectedOrderState(updated);
        }
      }

      const currentPendingCount = data.orders.filter((o) => o.status === "Pendente").length;
      if (
        soundEnabled &&
        prevPendingCountRef.current !== null &&
        currentPendingCount > prevPendingCountRef.current
      ) {
        playChimeSound();
      }
      prevPendingCountRef.current = currentPendingCount;
    }
  }, [soundEnabled]);

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/kitchen";
  }

  return (
    <main onClick={unlockAudio} className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-lg border border-white/10 bg-black/35 shadow-[0_30px_100px_rgba(0,0,0,0.55)] lg:grid-cols-[140px_1fr]">
        <aside className="hidden border-r border-white/10 bg-zinc-950/90 p-4 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="relative mx-auto mb-8 h-16 w-16 overflow-hidden rounded-full border border-red-500/40">
              <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
            </div>
            <div className="space-y-2 text-xs text-zinc-400">
              {[
                ["Pedidos", "pedidos"],
                ["Historico", "historico"],
                ["Cardapio", "cardapio"],
                ["Mesas", "mesas"]
              ].map(([item, view]) => (
                <button
                  key={item}
                  onClick={() => setActiveView(view as typeof activeView)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left transition hover:bg-white/[0.06]",
                    activeView === view && "bg-red-600 text-white"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-xs text-red-300 hover:bg-red-500/10">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </aside>

        <section className="p-4 lg:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Painel da cozinha</p>
              <h1 className="text-2xl font-semibold">
                {activeView === "pedidos" && "Fila de preparo realtime"}
                {activeView === "historico" && "Historico de entregas"}
                {activeView === "cardapio" && "Consulta do cardapio"}
                {activeView === "mesas" && "Mesas em atendimento"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) playChimeSound();
                }}
                className="text-xs"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-300" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
                {soundEnabled ? "Som Ativo" : "Som Mudo"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="lg:hidden text-xs text-red-300">
                <LogOut className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                <ChefHat className="h-4 w-4" />
                Operacao ao vivo
              </div>
            </div>
          </div>

          {activeView === "pedidos" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                      <Card
                        key={order.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOrder(order);
                        }}
                        className="group relative border-white/10 bg-zinc-950/80 p-3 cursor-pointer transition hover:border-red-500/50 hover:bg-zinc-900/90"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white group-hover:text-red-300">{order.table}</p>
                            <p className="text-xs text-red-200">{order.guest}</p>
                          </div>
                          <span className="font-mono text-xs text-zinc-500">{order.id}</span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-zinc-300">
                          {order.items.map((item, index) => (
                            <p key={`${order.id}-${index}-${item}`}>{item}</p>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          {order.status === "Entregue" ? (
                            <span className="flex items-center gap-1 font-medium text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              Entregue
                            </span>
                          ) : (
                            <span className={cn("flex items-center gap-1 font-medium", order.minutes > 15 && "text-red-400 font-bold")}>
                              {order.minutes > 15 ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 animate-pulse" /> : <Clock3 className="h-3.5 w-3.5" />}
                              {order.minutes} min
                            </span>
                          )}
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                        {order.status !== "Entregue" && (
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              advanceOrder(order.id);
                            }}
                          >
                            Avancar status
                          </Button>
                        )}
                        <div className="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100">
                          <Maximize2 className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                      </Card>
                    ))}
                </div>
                </div>
              ))}
            </div>
          )}

          {activeView === "historico" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {orders
                .filter((order) => order.status === "Entregue" && isSameLocalDay((order as { createdAt?: string }).createdAt))
                .map((order) => (
                  <Card key={order.id} className="border-white/10 bg-zinc-950/80 p-3">
                    <p className="text-sm font-semibold">{order.table}</p>
                    <p className="text-xs text-zinc-500">{order.guest}</p>
                    <p className="mt-3 text-sm text-emerald-300">Entregue</p>
                  </Card>
                ))}
            </div>
          )}

          {activeView === "cardapio" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => (
                <Card key={item.name} className="border-white/10 bg-zinc-950/80 p-3">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.category}</p>
                  <p className="mt-3 text-sm text-red-300">{formatCurrency(item.price)}</p>
                </Card>
              ))}
            </div>
          )}

          {activeView === "mesas" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 30 }, (_, index) => index + 1).map((table) => (
                <Card key={table} className="border-white/10 bg-zinc-950/80 p-4">
                  <p className="text-sm font-semibold">Mesa {table.toString().padStart(2, "0")}</p>
                  <p className="mt-2 text-xs text-emerald-300">Disponivel / QR ativo</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => handleSelectOrder(null)}
          onAdvance={(id) => {
            advanceOrder(id);
          }}
        />
      )}
    </main>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onAdvance
}: {
  order: KitchenOrder;
  onClose: () => void;
  onAdvance: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-md"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-[#0d0e12] p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-red-400 font-bold">{order.id}</span>
            <h2 className="text-3xl font-black text-white mt-1">{order.table}</h2>
            <p className="text-base text-zinc-300 font-semibold mt-1">Cliente: {order.guest}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn("text-sm px-3 py-1", statusStyles[order.status])}>{order.status}</Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm">
            <span className="text-zinc-400">
              {order.status === "Entregue" ? "Status de Atendimento:" : "Tempo de espera na cozinha:"}
            </span>
            {order.status === "Entregue" ? (
              <span className="font-mono font-bold text-base flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Concluído / Entregue
              </span>
            ) : (
              <span className={cn("font-mono font-bold text-base flex items-center gap-1", order.minutes > 15 ? "text-red-400" : "text-emerald-400")}>
                {order.minutes > 15 && <AlertTriangle className="h-4 w-4 animate-bounce text-red-400" />}
                {order.minutes} minutos
              </span>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Itens do Pedido:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {order.items.map((item, index) => (
                <div key={`${order.id}-item-${index}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/90 p-4">
                  <span className="text-lg font-bold text-zinc-100">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base">
            <span className="text-zinc-400">Total do Pedido:</span>
            <span className="font-mono text-xl font-bold text-emerald-300">{formatCurrency(order.total)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 text-xs py-5 gap-1.5 border-white/20"
            onClick={(e) => {
              e.stopPropagation();
              printTicket({
                title: "TICKET DE COZINHA",
                tableNumber: order.table,
                customerNames: [order.guest],
                items: order.items.map((itemStr) => ({ label: itemStr, totalCents: 0 })),
                totalCents: Math.round(order.total * 100)
              });
            }}
          >
            <Printer className="h-4 w-4 text-zinc-300" />
            Imprimir Ticket
          </Button>
          <Button
            variant="secondary"
            className="flex-1 text-xs py-5"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            Fechar Janela
          </Button>
          {order.status !== "Entregue" && (
            <Button
              className="flex-1 text-xs py-5 font-bold"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(order.id);
              }}
            >
              Avançar Status
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
