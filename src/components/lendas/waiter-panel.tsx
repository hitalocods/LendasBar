"use client";

import Image from "next/image";
import { Bell, CheckCircle2, Clock3, Hand, ReceiptText, RefreshCw, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

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

export function WaiterPanel() {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState("");

  const loadData = useCallback(async () => {
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

  const openTables = tables.filter((table) => table.sessionId && (!selectedWaiterId || table.waiter?.id === selectedWaiterId));
  const selectedWaiter = waiters.find((waiter) => waiter.id === selectedWaiterId);

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-red-500/40">
              <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Atendimento</p>
              <h1 className="text-2xl font-semibold">Painel do garcom</h1>
            </div>
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </header>

        <Card className="border-white/10 bg-black/45 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-red-300" />
            Responsavel em atendimento
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <select
              value={selectedWaiterId}
              onChange={(event) => setSelectedWaiterId(event.target.value)}
              className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-red-500"
            >
              <option value="">Todos os garcons</option>
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name} - mesas {waiter.tables}
                </option>
              ))}
            </select>
            <Badge className="w-fit border-red-500/30 bg-red-500/10 text-red-100">
              {selectedWaiter ? `Mesas ${selectedWaiter.tables}` : "Visao geral"}
            </Badge>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric icon={Bell} label="Chamados abertos" value={String(calls.filter((call) => call.type === "WAITER").length)} />
          <Metric icon={ReceiptText} label="Contas pedidas" value={String(calls.filter((call) => call.type === "BILL").length)} />
          <Metric icon={Users} label="Minhas mesas abertas" value={String(openTables.length)} />
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="border-white/10 bg-black/45 p-4">
            <h2 className="mb-4 text-lg font-semibold">Chamados</h2>
            <div className="space-y-3">
              {calls.length === 0 && <p className="text-sm text-zinc-500">Nenhum chamado aberto.</p>}
              {calls.map((call) => (
                <div key={call.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{call.table}</p>
                      <p className="text-sm text-zinc-500">{call.customerName}</p>
                      <p className="text-xs text-zinc-600">{call.waiter?.name ?? "Sem garcom atribuido"}</p>
                    </div>
                    <Badge className={call.type === "BILL" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-red-500/30 bg-red-500/10 text-red-100"}>
                      {call.type === "BILL" ? "Conta" : "Garcom"}
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
            <h2 className="mb-4 text-lg font-semibold">Mesas abertas</h2>
            <div className="space-y-3">
              {openTables.length === 0 && <p className="text-sm text-zinc-500">Nenhuma mesa aberta.</p>}
              {openTables.map((table) => (
                <div key={table.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Mesa {table.number.toString().padStart(2, "0")}</p>
                      <p className="text-sm text-zinc-500">{table.guests.join(", ") || "Sem nomes"}</p>
                      <p className="text-xs text-zinc-600">{table.waiter?.name ?? "Sem garcom atribuido"}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-300">{formatCurrency(table.total / 100)}</p>
                  </div>
                  <Button className="mt-3 w-full" variant="secondary" onClick={() => closeTable(table.qrToken)}>
                    Fechar conta
                  </Button>
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
