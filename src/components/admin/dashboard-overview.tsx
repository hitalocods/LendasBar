"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Bell, ChefHat, Clock, CreditCard, DollarSign, LayoutGrid, Users, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import type { TableRow } from "./types";

type ActiveCall = {
  id: string;
  tableNumber: number;
  customerName: string;
  type: "WAITER" | "BILL";
  minutes: number;
};

type OrderItem = {
  id: string;
  table: string;
  guest: string;
  items: string[];
  total: number;
  status: string;
  minutes: number;
};

export function DashboardOverview({
  onNavigate
}: {
  onNavigate: (view: "pedidos" | "cardapio" | "qrcodes" | "equipe") => void;
}) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, callsRes, ordersRes] = await Promise.all([
        fetch("/api/tables", { cache: "no-store" }).catch(() => null),
        fetch("/api/waiter-calls", { cache: "no-store" }).catch(() => null),
        fetch("/api/orders", { cache: "no-store" }).catch(() => null)
      ]);

      if (tablesRes?.ok) {
        const d = await tablesRes.json();
        setTables(d.tables ?? []);
      }
      if (callsRes?.ok) {
        const d = await callsRes.json();
        setCalls(d.calls ?? []);
      }
      if (ordersRes?.ok) {
        const d = await ordersRes.json();
        setOrders(d.orders ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const busyTables = tables.filter((t) => Boolean(t.sessionId));
  const billCalls = calls.filter((c) => c.type === "BILL");
  const waiterCalls = calls.filter((c) => c.type === "WAITER");
  const pendingOrders = orders.filter((o) => o.status === "Pendente" || o.status === "Em preparo");

  // Faturamento estimado das mesas ativas + total de pedidos
  const activeTablesRevenue = busyTables.reduce((sum, t) => sum + (t.total || 0), 0) / 100;
  const ordersTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalRevenue = Math.max(activeTablesRevenue, ordersTotal);

  return (
    <div className="space-y-6">
      {/* 4 Cards de Métricas Principais */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Faturamento */}
        <Card className="border-red-500/30 bg-gradient-to-br from-red-950/40 via-black to-zinc-950 p-4 shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento do Dia</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/40 bg-red-600/20 text-red-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-white">{formatCurrency(totalRevenue)}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {busyTables.length} {busyTables.length === 1 ? "comanda ativa" : "comandas ativas"}
            </p>
          </div>
        </Card>

        {/* Mesas Ocupadas */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-black to-zinc-950 p-4 shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ocupação do Salão</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/40 bg-emerald-600/20 text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">{busyTables.length}</p>
              <span className="text-xs text-zinc-400">/ {tables.length || 30} mesas</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {(tables.length || 30) - busyTables.length} mesas livres agora
            </p>
          </div>
        </Card>

        {/* Cozinha & Bar / Pedidos em preparo */}
        <Card
          onClick={() => onNavigate("pedidos")}
          className="border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-black to-zinc-950 p-4 shadow-xl cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Cozinha & Bar</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-amber-500/40 bg-amber-600/20 text-amber-400">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-2xl sm:text-3xl font-black text-amber-300">{pendingOrders.length}</p>
              <span className="text-xs text-amber-400 font-bold underline flex items-center gap-0.5">
                Ver KDS <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">pedidos na fila de preparo</p>
          </div>
        </Card>

        {/* Chamados do Salão */}
        <Card className="border-red-500/30 bg-gradient-to-br from-red-950/30 via-black to-zinc-950 p-4 shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Chamados & Contas</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/40 bg-red-600/20 text-red-400">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-white">{calls.length}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {billCalls.length > 0 && <span className="text-amber-300 font-bold">{billCalls.length} pedindo conta · </span>}
              {waiterCalls.length} atendimento
            </p>
          </div>
        </Card>
      </div>

      {/* Mini Mapa do Salão em Tempo Real (Estilo Consumer) */}
      <Card className="border-white/10 bg-black/45 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-red-500" />
              Mapa Visual das Mesas (Salão)
            </h2>
            <p className="text-xs text-zinc-400">Status em tempo real das 30 mesas do bar.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-zinc-800 border border-white/20" /> Livre
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ocupada
            </span>
            <span className="flex items-center gap-1.5 text-amber-300 font-medium">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Pediu Conta
            </span>
            <span className="flex items-center gap-1.5 text-red-400 font-medium">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> Chamando
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 min-[520px]:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {tables.slice(0, 30).map((table) => {
            const isBusy = Boolean(table.sessionId);
            const tableCalls = calls.filter((c) => c.tableNumber === table.number);
            const wantsBill = table.status === "WAITING_BILL" || tableCalls.some((c) => c.type === "BILL");
            const wantsWaiter = tableCalls.some((c) => c.type === "WAITER");

            const tone = wantsWaiter
              ? "bg-red-600 border-red-400 text-white animate-pulse"
              : wantsBill
                ? "bg-amber-400 border-amber-300 text-black font-bold animate-pulse"
                : isBusy
                  ? "bg-emerald-500 border-emerald-400 text-black font-bold"
                  : "bg-zinc-800/80 border-white/10 text-zinc-300 hover:border-white/20";

            return (
              <div
                key={table.id}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-center transition shadow-sm",
                  tone
                )}
              >
                <span className="text-sm sm:text-base font-black leading-none">
                  {String(table.number).padStart(2, "0")}
                </span>
                {isBusy && table.total > 0 && (
                  <span className="mt-0.5 text-[9px] font-mono leading-none truncate max-w-full px-0.5">
                    {formatCurrency(table.total / 100)}
                  </span>
                )}
                {wantsBill && (
                  <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-white text-black shadow">
                    <CreditCard className="h-2.5 w-2.5 text-amber-600" />
                  </span>
                )}
                {wantsWaiter && (
                  <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-white text-black shadow">
                    <Bell className="h-2.5 w-2.5 text-red-600" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <span>Para gerenciar placas e QR Codes para as mesas:</span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs font-bold border-white/10"
            onClick={() => onNavigate("qrcodes")}
          >
            Imprimir QR Codes das Mesas
          </Button>
        </div>
      </Card>

      {/* Grade de 2 Colunas: Últimos Pedidos & Chamados do Salão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimos Pedidos em Andamento */}
        <Card className="border-white/10 bg-black/45 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base">
              <UtensilsCrossed className="h-4 w-4 text-red-400" />
              Fila de Pedidos Ativos
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-400 font-bold p-0 hover:bg-transparent"
              onClick={() => onNavigate("pedidos")}
            >
              Abrir KDS →
            </Button>
          </div>

          {orders.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">Nenhum pedido ativo no momento.</p>
          ) : (
            <div className="space-y-2.5">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{order.table}</span>
                      <span className="text-xs text-zinc-400">· {order.guest}</span>
                      <span className="text-[10px] text-zinc-500">há {order.minutes} min</span>
                    </div>
                    <p className="text-xs text-zinc-300 truncate mt-0.5 font-medium">
                      {order.items.join(", ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-xs text-emerald-400">{formatCurrency(order.total)}</p>
                    <Badge
                      className={cn(
                        "text-[9px] px-1.5 py-0 mt-0.5 font-bold",
                        order.status === "Pronto"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : order.status === "Em preparo"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-red-500/20 text-red-300 border-red-500/40"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Chamados do Salão */}
        <Card className="border-white/10 bg-black/45 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base">
              <Bell className="h-4 w-4 text-red-400" />
              Chamados e Pedidos de Conta
            </h3>
            <span className="text-xs text-zinc-500">{calls.length} pendentes</span>
          </div>

          {calls.length === 0 ? (
            <p className="py-6 text-center text-xs text-emerald-400/80">Nenhum chamado pendente no salão.</p>
          ) : (
            <div className="space-y-2.5">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3",
                    call.type === "BILL"
                      ? "border-amber-500/40 bg-amber-950/20 text-amber-200"
                      : "border-red-500/40 bg-red-950/20 text-red-200"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white">
                      {call.type === "BILL" ? "💳 Pediu a conta" : "🔔 Chamando garçom"} · Mesa {call.tableNumber}
                    </p>
                    <p className="text-xs text-zinc-300 truncate mt-0.5">
                      {call.customerName} · há {call.minutes} min
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className={cn(
                      "text-xs font-bold h-8",
                      call.type === "BILL"
                        ? "bg-amber-500 hover:bg-amber-400 text-black"
                        : "bg-red-600 hover:bg-red-500 text-white"
                    )}
                    onClick={async () => {
                      await fetch(`/api/waiter-calls/${call.id}/resolve`, { method: "POST" });
                      loadData();
                    }}
                  >
                    Atendido
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
