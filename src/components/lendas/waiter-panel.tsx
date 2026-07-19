"use client";

import Image from "next/image";
import { AlertCircle, Bell, CheckCircle2, Clock3, Copy, Hand, LogOut, Printer, ReceiptText, RefreshCw, UserRound, Users, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { printTicket } from "@/lib/print-ticket";

type WaiterCall = {
  id: string;
  table: string;
  customerName: string;
  type: "WAITER" | "BILL";
  status: string;
  waiter: { id: string; name: string } | null;
  minutes: number;
};

type Waiter = {
  id: string;
  name: string;
  email?: string | null;
  tables: string;
};

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

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login?next=/waiter";
}

export function WaiterPanel() {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlWaiterId = params.get("waiterId");
      if (urlWaiterId) {
        setSelectedWaiterId(urlWaiterId);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const callsUrl = selectedWaiterId ? `/api/waiter-calls?waiterId=${selectedWaiterId}` : "/api/waiter-calls";
      const [callsResponse, tablesResponse, waitersResponse] = await Promise.all([
        fetch(callsUrl, { cache: "no-store" }),
        fetch("/api/tables", { cache: "no-store" }),
        fetch("/api/waiters", { cache: "no-store" })
      ]);

      if (callsResponse.ok) {
        const data = (await callsResponse.json()) as { calls?: WaiterCall[] };
        setCalls(data.calls ?? []);
      }

      if (tablesResponse.ok) {
        const data = (await tablesResponse.json()) as { tables?: TableRow[] };
        setTables(data.tables ?? []);
      }

      if (waitersResponse.ok) {
        const data = (await waitersResponse.json()) as { waiters?: Waiter[] };
        setWaiters(data.waiters ?? []);
      }
    } catch {
      // Prevent unhandled promise rejection on network hiccups
    }
  }, [selectedWaiterId]);

  useEffect(() => {
    window.setTimeout(loadData, 0);
    const interval = window.setInterval(loadData, 2500);
    return () => window.clearInterval(interval);
  }, [loadData]);

  async function resolveCall(id: string) {
    await fetch(`/api/waiter-calls/${id}/resolve`, { method: "POST" });
    await loadData();
  }

  async function acknowledgeCall(id: string) {
    await fetch(`/api/waiter-calls/${id}/acknowledge`, { method: "POST" });
    await loadData();
  }

  async function closeTable(token: string) {
    await fetch(`/api/tables/${token}/close`, { method: "POST" });
    await loadData();
  }

  async function handlePrintTableBill(token: string, tableNumber: number, guests: string[]) {
    const res = await fetch(`/api/tables/${token}/bill`, { cache: "no-store" });
    if (!res.ok) return;
    const billData = (await res.json()) as {
      total?: number;
      groups?: Array<{ customerName: string; lines?: Array<{ label: string; value: number }> }>;
    };
    const items: Array<{ label: string; totalCents: number }> = [];
    for (const group of billData.groups ?? []) {
      for (const line of group.lines ?? []) {
        items.push({ label: `${line.label} (${group.customerName})`, totalCents: line.value });
      }
    }
    printTicket({
      tableNumber,
      customerNames: guests,
      items,
      totalCents: billData.total ?? 0
    });
  }

  function handleCopyDirectLink() {
    if (!selectedWaiterId || typeof window === "undefined") return;
    const directUrl = `${window.location.origin}/waiter?waiterId=${selectedWaiterId}`;
    navigator.clipboard.writeText(directUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  const openTables = tables.filter((table) => table.sessionId && (!selectedWaiterId || table.waiter?.id === selectedWaiterId));
  const selectedWaiter = waiters.find((waiter) => waiter.id === selectedWaiterId);

  const unattendedCalls = calls.filter((call) => call.status !== "ACKNOWLEDGED");

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-red-500/40">
              <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Atendimento ao Vivo</p>
              <h1 className="text-2xl font-semibold">Painel do Garçom</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-red-300 hover:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </header>

        <Card className="border-white/10 bg-black/45 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-red-300" />
              Selecione seu Perfil de Garçom
            </div>
            {selectedWaiterId && (
              <Button size="sm" variant="outline" onClick={handleCopyDirectLink} className="text-xs gap-1 border-white/10">
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? "Link Copiado!" : "Copiar Meu Link Direto"}
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <select
              value={selectedWaiterId}
              onChange={(event) => {
                const val = event.target.value;
                setSelectedWaiterId(val);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  if (val) url.searchParams.set("waiterId", val);
                  else url.searchParams.delete("waiterId");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-red-500"
            >
              <option value="">Visão Geral (Todos os Garçons)</option>
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name} — Mesas {waiter.tables}
                </option>
              ))}
            </select>
            <Badge className="w-fit border-red-500/30 bg-red-500/10 text-red-100">
              {selectedWaiter ? `Atribuição: Mesas ${selectedWaiter.tables}` : "Visão Geral Completa"}
            </Badge>
          </div>
        </Card>

        {unattendedCalls.length > 0 && (
          <Card className="border-red-500/40 bg-red-500/10 p-4 shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-pulse">
            <div className="flex items-center gap-2 font-bold text-red-200 mb-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span>🚨 {unattendedCalls.length} Chamado(s) Pendente(s) Sem Atendimento!</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {unattendedCalls.map((call) => (
                <div key={`urgent-${call.id}`} className="rounded-lg border border-red-500/30 bg-black/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">{call.table}</span>
                    <Badge className={call.type === "BILL" ? "bg-amber-500/20 text-amber-200 border-amber-500/40" : "bg-red-500/20 text-red-200 border-red-500/40"}>
                      {call.type === "BILL" ? "Conta Solicitada" : "Garçom Chamado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">Cliente: {call.customerName}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-mono">{call.minutes} min atrás</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs" onClick={() => acknowledgeCall(call.id)}>
                      Atender Agora
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <Metric icon={Bell} label="Chamados abertos" value={String(calls.filter((call) => call.type === "WAITER").length)} />
          <Metric icon={ReceiptText} label="Contas pedidas" value={String(calls.filter((call) => call.type === "BILL").length)} />
          <Metric icon={Users} label="Minhas mesas abertas" value={String(openTables.length)} />
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="border-white/10 bg-black/45 p-4">
            <h2 className="mb-4 text-lg font-semibold">Fila de Chamados da Minha Faixa</h2>
            <div className="space-y-3">
              {calls.length === 0 && <p className="text-sm text-zinc-500">Nenhum chamado aberto no momento.</p>}
              {calls.map((call) => (
                <div key={call.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{call.table}</p>
                      <p className="text-sm text-zinc-500">{call.customerName}</p>
                      <p className="text-xs text-zinc-600">{call.waiter?.name ?? "Sem garçom atribuído"}</p>
                    </div>
                    <Badge className={call.type === "BILL" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-red-500/30 bg-red-500/10 text-red-100"}>
                      {call.type === "BILL" ? "Conta" : "Garçom"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {call.minutes} min
                    </span>
                    <div className="flex gap-2">
                      {call.status !== "ACKNOWLEDGED" && (
                        <Button size="sm" variant="secondary" onClick={() => acknowledgeCall(call.id)}>
                          <Hand className="h-4 w-4" />
                          Atender
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolveCall(call.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Finalizar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-white/10 bg-black/45 p-4">
            <h2 className="mb-4 text-lg font-semibold">Mesas sob Minha Responsabilidade</h2>
            <div className="space-y-3">
              {openTables.length === 0 && <p className="text-sm text-zinc-500">Nenhuma mesa aberta para este garçom.</p>}
              {openTables.map((table) => (
                <div key={table.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Mesa {table.number.toString().padStart(2, "0")}</p>
                      <p className="text-sm text-zinc-500">{table.guests.join(", ") || "Sem clientes nomeados"}</p>
                      <p className="text-xs text-zinc-600">{table.waiter?.name ?? "Sem garçom atribuído"}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-300">{formatCurrency(table.total / 100)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1 border-white/10" onClick={() => handlePrintTableBill(table.qrToken, table.number, table.guests)}>
                      <Printer className="h-3.5 w-3.5 text-zinc-300" />
                      Imprimir Comanda
                    </Button>
                    <Button size="sm" className="flex-1 text-xs" variant="secondary" onClick={() => closeTable(table.qrToken)}>
                      Fechar conta
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.045] p-4">
      <Icon className="mb-3 h-5 w-5 text-red-300" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
