"use client";

import Link from "next/link";
import { AlertCircle, Bell, CheckCircle2, ChefHat, Clock, CreditCard, LayoutGrid, LogOut, Plus, RotateCcw, Trash2, Users, Utensils, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { playChime } from "@/lib/chime";
import { cn, formatCurrency } from "@/lib/utils";

type TableRow = {
  id: string;
  number: number;
  qrToken: string;
  status: string;
  sessionId: string | null;
  waiter: { id: string; name: string } | null;
  guests: string[];
  total: number;
};

type ActiveCall = {
  id: string;
  tableNumber: number;
  customerName: string;
  type: "WAITER" | "BILL";
  minutes: number;
};

type KitchenOrder = {
  id: string;
  table: string;
  guest: string;
  items: string[];
  total: number;
  status: string;
  minutes: number;
};

type WaiterView = "mesas" | "chamados" | "cozinha";
type TableFilter = "all" | "free" | "busy" | "alerts";

const POLL_MS = 4000;

export function WaiterTables({ waiterName }: { waiterName: string }) {
  const [activeView, setActiveView] = useState<WaiterView>("mesas");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<TableFilter>("all");
  const [soundOn, setSoundOn] = useState(true);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [closingTable, setClosingTable] = useState(false);
  const knownCallIds = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundOn);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const load = useCallback(async () => {
    try {
      const [tablesRes, callsRes, ordersRes] = await Promise.all([
        fetch("/api/tables", { cache: "no-store" }).catch(() => null),
        fetch("/api/waiter-calls", { cache: "no-store" }).catch(() => null),
        fetch("/api/orders", { cache: "no-store" }).catch(() => null)
      ]);

      if (tablesRes?.status === 403 || callsRes?.status === 403) {
        window.location.href = "/login?next=/garcom";
        return;
      }

      if (tablesRes?.ok) {
        const data = (await tablesRes.json()) as { tables?: TableRow[] };
        setTables(data.tables ?? []);
      }

      if (callsRes?.ok) {
        const data = (await callsRes.json()) as { calls?: ActiveCall[] };
        const active = data.calls ?? [];
        const ids = new Set(active.map((call) => call.id));
        if (knownCallIds.current && soundRef.current && active.some((call) => !knownCallIds.current!.has(call.id))) {
          playChime();
        }
        knownCallIds.current = ids;
        setCalls(active);
      }

      if (ordersRes?.ok) {
        const data = (await ordersRes.json()) as { orders?: KitchenOrder[] };
        setOrders(data.orders ?? []);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    let interval = window.setInterval(load, POLL_MS);

    function onVisibility() {
      window.clearInterval(interval);
      if (!document.hidden) {
        load().catch(() => {});
        interval = window.setInterval(load, POLL_MS);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const callsByTable = useMemo(() => {
    const map = new Map<number, ActiveCall[]>();
    for (const call of calls) map.set(call.tableNumber, [...(map.get(call.tableNumber) ?? []), call]);
    return map;
  }, [calls]);

  const isBusy = (table: TableRow) => Boolean(table.sessionId);
  const hasAlert = (table: TableRow) => (callsByTable.get(table.number)?.length ?? 0) > 0;

  const busyCount = tables.filter(isBusy).length;
  const alertCount = tables.filter(hasAlert).length;
  const readyOrdersCount = orders.filter((o) => o.status === "Pronto").length;

  const visibleTables = tables.filter((table) => {
    if (filter === "free") return !isBusy(table);
    if (filter === "busy") return isBusy(table);
    if (filter === "alerts") return hasAlert(table);
    return true;
  });

  async function resolveCall(id: string) {
    await fetch(`/api/waiter-calls/${id}/resolve`, { method: "POST" });
    await load();
  }

  async function closeTable(token: string) {
    setClosingTable(true);
    try {
      await fetch(`/api/tables/${token}/close`, { method: "POST" });
      setActionFeedback("Mesa liberada e comanda zerada com sucesso!");
      setTimeout(() => {
        setSelected(null);
        setActionFeedback(null);
      }, 1200);
      await load();
    } finally {
      setClosingTable(false);
    }
  }

  async function triggerBillCall(token: string, paymentMethod: string) {
    await fetch("/api/waiter-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableToken: token,
        customerName: `Garçom (${waiterName}) - ${paymentMethod}`,
        type: "BILL"
      })
    });
    setActionFeedback(`Conta sinalizada (${paymentMethod})!`);
    await load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/garcom";
  }

  const selectedCalls = selected ? (callsByTable.get(selected.number) ?? []) : [];

  return (
    <main className="min-h-screen bg-background px-3 pb-12 pt-3 text-foreground min-[520px]:px-5">
      <div className="mx-auto max-w-6xl space-y-3.5">
        {/* Cabeçalho do Garçom */}
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500 text-black font-extrabold text-[10px] uppercase">
                Painel Garçom
              </Badge>
              <h1 className="text-xl sm:text-2xl font-black text-white">Olá, {waiterName}</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {busyCount} {busyCount === 1 ? "mesa ocupada" : "mesas ocupadas"} · {tables.length - busyCount} livres
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" asChild className="border-white/15 text-xs text-zinc-300 h-9 font-semibold hover:text-white">
              <Link href={"/admin" as any}>
                Painel Dono
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSoundOn((v) => !v)}
              className="gap-1.5 text-xs text-zinc-300 h-9"
              aria-label={soundOn ? "Silenciar alertas" : "Ativar som dos alertas"}
            >
              {soundOn ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
              <span className="hidden sm:inline">{soundOn ? "Som Ativo" : "Mudo"}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={logout} className="gap-1 text-xs text-red-300 h-9 hover:bg-red-500/10">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        {/* 3 Abas Principais do Garçom */}
        <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setActiveView("mesas")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition",
              activeView === "mesas"
                ? "bg-red-600 text-white shadow-lg shadow-red-950/40"
                : "bg-white/[0.04] text-zinc-300 hover:bg-white/10"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Mapa de Mesas</span>
          </button>

          <button
            onClick={() => setActiveView("chamados")}
            className={cn(
              "relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition",
              activeView === "chamados"
                ? "bg-red-600 text-white shadow-lg shadow-red-950/40"
                : "bg-white/[0.04] text-zinc-300 hover:bg-white/10",
              alertCount > 0 && activeView !== "chamados" && "border border-amber-500/60 text-amber-300"
            )}
          >
            <Bell className={cn("h-4 w-4", alertCount > 0 && "animate-bounce text-amber-400")} />
            <span>Chamados</span>
            {alertCount > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow">
                {alertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView("cozinha")}
            className={cn(
              "relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition",
              activeView === "cozinha"
                ? "bg-red-600 text-white shadow-lg shadow-red-950/40"
                : "bg-white/[0.04] text-zinc-300 hover:bg-white/10",
              readyOrdersCount > 0 && activeView !== "cozinha" && "border border-emerald-500/60 text-emerald-300"
            )}
          >
            <ChefHat className="h-4 w-4" />
            <span>Cozinha</span>
            {readyOrdersCount > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-black text-black shadow">
                {readyOrdersCount}
              </span>
            )}
          </button>
        </div>

        {/* VISÃO 1: MAPA DE MESAS (CONSUMER STYLE) */}
        {activeView === "mesas" && (
          <div className="space-y-3">
            {/* Filtros das Mesas + Legenda de Cores */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {(
                  [
                    ["all", `Todas (${tables.length})`],
                    ["free", `Livres (${tables.length - busyCount})`],
                    ["busy", `Ocupadas (${busyCount})`],
                    ["alerts", `Chamados (${alertCount})`]
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                      filter === value
                        ? "border-red-500/60 bg-red-600 text-white"
                        : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10",
                      value === "alerts" && alertCount > 0 && filter !== value && "border-amber-500/60 text-amber-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <Legend className="bg-zinc-800 border border-white/20" label="Livre" />
                <Legend className="bg-emerald-500" label="Ocupada" />
                <Legend className="bg-amber-400" label="Conta" />
                <Legend className="bg-red-600" label="Chamar" />
              </div>
            </div>

            {!loaded && <p className="py-10 text-center text-sm text-zinc-500">Carregando mesas...</p>}
            {loaded && visibleTables.length === 0 && (
              <p className="py-10 text-center text-sm text-zinc-500">Nenhuma mesa encontrada neste filtro.</p>
            )}

            {/* A Grade Visual de Mesas (Idêntica ao Consumer) */}
            <div className="grid grid-cols-4 gap-2.5 min-[520px]:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
              {visibleTables.map((table) => (
                <TableTile
                  key={table.id}
                  table={table}
                  calls={callsByTable.get(table.number) ?? []}
                  onSelect={() => setSelected(table)}
                />
              ))}
            </div>
          </div>
        )}

        {/* VISÃO 2: FILA DE CHAMADOS EM TEMPO REAL */}
        {activeView === "chamados" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Chamados Ativos do Salão</h2>
                <p className="text-xs text-zinc-400">Ordem cronológica das mesas que precisam de atendimento ou conta.</p>
              </div>
              <Button size="sm" variant="outline" onClick={load} className="text-xs border-white/10 gap-1">
                <RotateCcw className="h-3 w-3" /> Atualizar
              </Button>
            </div>

            {calls.length === 0 ? (
              <Card className="border-white/10 bg-black/40 p-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Todos os chamados atendidos</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Nenhuma mesa aguardando no momento.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {calls.map((call) => {
                  const isBill = call.type === "BILL";
                  return (
                    <Card
                      key={call.id}
                      className={cn(
                        "p-4 flex items-center justify-between gap-3 shadow-lg",
                        isBill
                          ? "border-amber-500/50 bg-gradient-to-r from-amber-950/30 to-black/80"
                          : "border-red-500/50 bg-gradient-to-r from-red-950/30 to-black/80"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            "grid h-12 w-12 shrink-0 place-items-center rounded-xl border font-black text-sm",
                            isBill
                              ? "border-amber-400/50 bg-amber-400/20 text-amber-300"
                              : "border-red-500/50 bg-red-600/20 text-red-400"
                          )}
                        >
                          {call.tableNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-white">
                            {isBill ? "💳 Pediu a Conta" : "🔔 Chamar Garçom"}
                          </p>
                          <p className="text-xs text-zinc-300 truncate mt-0.5">{call.customerName}</p>
                          <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> há {call.minutes} min
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className={cn(
                            "font-bold text-xs h-8",
                            isBill ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-red-600 text-white hover:bg-red-500"
                          )}
                          onClick={() => resolveCall(call.id)}
                        >
                          Atendido
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="text-[11px] h-7 border-white/10 text-zinc-300"
                        >
                          <Link href={`/garcom/mesa/${call.tableNumber}` as any}>
                            Ver Mesa
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISÃO 3: PEDIDOS DA COZINHA (PARA O GARÇOM SERVIR) */}
        {activeView === "cozinha" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Status dos Pedidos da Cozinha & Bar</h2>
                <p className="text-xs text-zinc-400">Acompanhe quando o pedido estiver "Pronto" para levar à mesa.</p>
              </div>
              <Button size="sm" variant="outline" onClick={load} className="text-xs border-white/10 gap-1">
                <RotateCcw className="h-3 w-3" /> Atualizar
              </Button>
            </div>

            {orders.length === 0 ? (
              <Card className="border-white/10 bg-black/40 p-8 text-center">
                <ChefHat className="mx-auto mb-2 h-10 w-10 text-zinc-600" />
                <h3 className="text-sm font-bold text-white">Nenhum pedido ativo</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Os pedidos lançados aparecerão aqui.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {orders.map((order) => {
                  const isReady = order.status === "Pronto";
                  const isPreparing = order.status === "Em preparo";

                  return (
                    <Card
                      key={order.id}
                      className={cn(
                        "p-3.5 space-y-2.5",
                        isReady
                          ? "border-emerald-500 bg-gradient-to-b from-emerald-950/40 to-black shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : isPreparing
                            ? "border-amber-500/40 bg-black/60"
                            : "border-white/10 bg-black/40 opacity-70"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-base text-white">{order.table}</span>
                        <Badge
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5",
                            isReady
                              ? "bg-emerald-500 text-black font-black animate-pulse"
                              : isPreparing
                                ? "bg-amber-400 text-black font-bold"
                                : "bg-zinc-700 text-zinc-300"
                          )}
                        >
                          {isReady ? "🔥 PRONTO P/ SERVIR" : order.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-zinc-300 font-medium">Cliente: {order.guest}</p>

                      <div className="space-y-1 py-1 border-y border-white/10 text-xs">
                        {order.items.map((it, idx) => (
                          <p key={idx} className="font-semibold text-zinc-100">{it}</p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Total: <strong className="text-emerald-400">{formatCurrency(order.total)}</strong></span>
                        <span>há {order.minutes} min</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL / GAVETA DA MESA SELECIONADA */}
      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/75 backdrop-blur-sm min-[520px]:place-items-center min-[520px]:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#101114] p-5 shadow-2xl min-[520px]:rounded-3xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header da Mesa */}
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-white">Mesa {String(selected.number).padStart(2, "0")}</h2>
                  <Badge
                    className={cn(
                      "text-[11px] font-bold px-2 py-0.5",
                      selected.status === "WAITING_BILL"
                        ? "bg-amber-400 text-black font-black"
                        : selected.sessionId
                          ? "bg-emerald-500 text-black font-black"
                          : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {selected.status === "WAITING_BILL"
                      ? "Aguardando Conta"
                      : selected.sessionId
                        ? "Ocupada / Comanda Aberta"
                        : "Mesa Livre"}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selected.guests.length > 0
                    ? `Clientes: ${selected.guests.join(", ")}`
                    : "Nenhum cliente cadastrado ainda"}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">Comanda</span>
                <p className="text-xl font-black text-emerald-400">
                  {formatCurrency((selected.total || 0) / 100)}
                </p>
              </div>
            </div>

            {/* Chamados da Mesa (se houver) */}
            {selectedCalls.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-300">Chamados pendentes desta mesa:</p>
                {selectedCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3"
                  >
                    <div className="text-xs">
                      <p className="font-bold text-white">
                        {call.type === "BILL" ? "💳 Pediu a conta" : "🔔 Chamando atendimento"}
                      </p>
                      <p className="text-zinc-400 mt-0.5">{call.customerName} · há {call.minutes} min</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 h-8"
                      onClick={() => resolveCall(call.id)}
                    >
                      Atendido
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Sinalizar Pedido de Conta Rápido */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <p className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-amber-400" />
                Sinalizar Pedido de Conta:
              </p>
              <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-1.5">
                {["Cartão Crédito", "Cartão Débito", "PIX", "Dinheiro"].map((m) => (
                  <button
                    key={m}
                    onClick={() => triggerBillCall(selected.qrToken, m)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[11px] font-medium text-zinc-300 hover:border-amber-400 hover:text-amber-300 transition"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {actionFeedback && (
              <p className="text-xs text-center font-bold text-emerald-400 animate-pulse">
                {actionFeedback}
              </p>
            )}

            {/* Ações Principais da Mesa */}
            <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2.5 pt-1">
              <Button asChild className="h-12 font-bold bg-emerald-600 hover:bg-emerald-500 text-white min-[480px]:col-span-2">
                <Link href={`/garcom/mesa/${selected.qrToken}` as any}>
                  <Utensils className="mr-2 h-4 w-4" />
                  Lançar Pedido no Cardápio
                </Link>
              </Button>

              <Button
                variant="outline"
                className="h-12 font-bold border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
                disabled={closingTable || !selected.sessionId}
                onClick={() => closeTable(selected.qrToken)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {closingTable ? "Fechando..." : "Liberar Mesa"}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full text-xs text-zinc-400 hover:text-white"
              onClick={() => setSelected(null)}
            >
              Fechar Detalhes
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}

function TableTile({
  table,
  calls,
  onSelect
}: {
  table: TableRow;
  calls: ActiveCall[];
  onSelect: () => void;
}) {
  const busy = Boolean(table.sessionId);
  const wantsBill = table.status === "WAITING_BILL" || calls.some((call) => call.type === "BILL");
  const wantsWaiter = calls.some((call) => call.type === "WAITER");
  const hasAlert = calls.length > 0;

  const tone = wantsWaiter
    ? "border-red-400 bg-red-600 text-white shadow-[0_0_24px_rgba(239,68,68,0.65)]"
    : wantsBill
      ? "border-amber-300 bg-amber-400 text-black shadow-[0_0_24px_rgba(251,191,36,0.55)]"
      : busy
        ? "border-emerald-400/80 bg-emerald-500 text-black font-extrabold"
        : "border-white/10 bg-zinc-800 text-zinc-300 hover:border-white/20";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-1 text-center transition active:scale-95 shadow-md",
        tone,
        hasAlert && "animate-pulse"
      )}
    >
      {/* Badge de Alerta na Quina Superior Direita */}
      {hasAlert && (
        <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 animate-bounce place-items-center rounded-full border-2 border-black bg-white text-black shadow-xl">
          {wantsWaiter ? <Bell className="h-4 w-4 text-red-600" /> : <CreditCard className="h-4 w-4 text-amber-600" />}
        </span>
      )}

      {/* Número da Mesa */}
      <span className="text-3xl font-black leading-none min-[520px]:text-4xl">
        {String(table.number).padStart(2, "0")}
      </span>

      {/* Informações da Mesa */}
      {busy ? (
        <span className="mt-1 flex flex-col items-center gap-0.5 text-[10px] min-[520px]:text-[11px] font-bold leading-tight">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {Math.max(table.guests.length, 1)}
          </span>
          {table.total > 0 && <span className="truncate max-w-full font-mono">{formatCurrency(table.total / 100)}</span>}
        </span>
      ) : (
        <span className="mt-1 text-[11px] font-medium opacity-60">Livre</span>
      )}
    </button>
  );
}
