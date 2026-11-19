"use client";

import Link from "next/link";
import { Bell, CreditCard, LogOut, Users, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

type Filter = "all" | "free" | "busy" | "alerts";

const POLL_MS = 4000;

export function WaiterTables({ waiterName }: { waiterName: string }) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [soundOn, setSoundOn] = useState(true);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const knownCallIds = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundOn);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const load = useCallback(async () => {
    const [tablesRes, callsRes] = await Promise.all([
      fetch("/api/tables", { cache: "no-store" }),
      fetch("/api/waiter-calls", { cache: "no-store" })
    ]);

    if (tablesRes.status === 403 || callsRes.status === 403) {
      window.location.href = "/login?next=/garcom";
      return;
    }

    if (tablesRes.ok) {
      const data = (await tablesRes.json()) as { tables?: TableRow[] };
      setTables(data.tables ?? []);
    }

    if (callsRes.ok) {
      const data = (await callsRes.json()) as { calls?: ActiveCall[] };
      const active = data.calls ?? [];
      const ids = new Set(active.map((call) => call.id));
      // Só avisa por som chamados novos (não no primeiro carregamento).
      if (knownCallIds.current && soundRef.current && active.some((call) => !knownCallIds.current!.has(call.id))) {
        playChime();
      }
      knownCallIds.current = ids;
      setCalls(active);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    window.setTimeout(load, 0);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/garcom";
  }

  const selectedCalls = selected ? (callsByTable.get(selected.number) ?? []) : [];

  return (
    <main className="min-h-screen bg-background px-3 pb-10 pt-4 text-foreground min-[520px]:px-5">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Salão</p>
            <h1 className="text-2xl font-bold">Olá, {waiterName}</h1>
            <p className="text-xs text-zinc-400">
              {busyCount} {busyCount === 1 ? "mesa ocupada" : "mesas ocupadas"} · {tables.length - busyCount} livres
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSoundOn((value) => !value)}
              className="gap-1 text-xs text-zinc-300"
              aria-label={soundOn ? "Silenciar alertas" : "Ativar som dos alertas"}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundOn ? "Som" : "Mudo"}
            </Button>
            <Button size="sm" variant="ghost" onClick={logout} className="gap-1 text-xs text-red-300">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
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
                "rounded-lg border px-3 py-2 text-xs font-bold transition min-[520px]:text-sm",
                filter === value
                  ? "border-red-500/60 bg-red-600 text-white"
                  : "border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/10",
                value === "alerts" && alertCount > 0 && filter !== value && "border-amber-500/60 text-amber-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          <Legend className="bg-zinc-700" label="Livre" />
          <Legend className="bg-emerald-500" label="Com clientes" />
          <Legend className="bg-amber-400" label="Pediu a conta" />
          <Legend className="bg-red-500" label="Chamando garçom" />
        </div>

        {!loaded && <p className="py-10 text-center text-sm text-zinc-500">Carregando mesas...</p>}
        {loaded && tables.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">Nenhuma mesa cadastrada ainda.</p>
        )}
        {loaded && tables.length > 0 && visibleTables.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">Nenhuma mesa nesse filtro.</p>
        )}

        <div className="grid grid-cols-3 gap-2.5 min-[520px]:grid-cols-4 min-[520px]:gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {visibleTables.map((table) => (
            <TableTile
              key={table.id}
              table={table}
              calls={callsByTable.get(table.number) ?? []}
              onOpenAlerts={() => setSelected(table)}
            />
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-black/75 backdrop-blur-sm min-[520px]:place-items-center min-[520px]:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#101114] p-5 shadow-2xl min-[520px]:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold">Mesa {String(selected.number).padStart(2, "0")}</h2>
            <p className="mb-4 text-xs text-zinc-400">
              {selected.guests.length > 0 ? `Clientes: ${selected.guests.join(", ")}` : "Sem clientes identificados"}
            </p>

            <div className="space-y-2">
              {selectedCalls.length === 0 && (
                <p className="text-sm text-emerald-300">Chamados atendidos.</p>
              )}
              {selectedCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3"
                >
                  <div className="text-sm">
                    <p className="font-bold text-white">
                      {call.type === "BILL" ? "💳 Pediu a conta" : "🔔 Chamando garçom"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {call.customerName} · há {call.minutes} min
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-500 font-bold text-black hover:bg-amber-400"
                    onClick={() => resolveCall(call.id)}
                  >
                    Atendido
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[0.4fr_1fr] gap-3">
              <Button variant="secondary" className="h-12" onClick={() => setSelected(null)}>
                Fechar
              </Button>
              <Button asChild className="h-12 font-bold">
                <Link href={`/garcom/mesa/${selected.qrToken}` as any}>Lançar pedido</Link>
              </Button>
            </div>
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
  onOpenAlerts
}: {
  table: TableRow;
  calls: ActiveCall[];
  onOpenAlerts: () => void;
}) {
  const busy = Boolean(table.sessionId);
  const wantsBill = table.status === "WAITING_BILL" || calls.some((call) => call.type === "BILL");
  const wantsWaiter = calls.some((call) => call.type === "WAITER");
  const hasAlert = calls.length > 0;

  const tone = wantsWaiter
    ? "border-red-400 bg-red-600/90 text-white shadow-[0_0_22px_rgba(239,68,68,0.55)]"
    : wantsBill
      ? "border-amber-300 bg-amber-400 text-black shadow-[0_0_22px_rgba(251,191,36,0.45)]"
      : busy
        ? "border-emerald-400/60 bg-emerald-500 text-black"
        : "border-white/10 bg-zinc-800 text-zinc-200";

  const content = (
    <>
      {hasAlert && (
        <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 animate-bounce place-items-center rounded-full border-2 border-black bg-white text-black shadow-lg">
          {wantsWaiter ? <Bell className="h-4 w-4 text-red-600" /> : <CreditCard className="h-4 w-4 text-amber-600" />}
        </span>
      )}
      <span className="text-3xl font-black leading-none min-[520px]:text-4xl">{String(table.number).padStart(2, "0")}</span>
      {busy ? (
        <span className="mt-1.5 flex flex-col items-center gap-0.5 text-[11px] font-semibold leading-tight">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {Math.max(table.guests.length, 1)}
          </span>
          {table.total > 0 && <span>{formatCurrency(table.total / 100)}</span>}
        </span>
      ) : (
        <span className="mt-1.5 text-[11px] font-medium opacity-60">Livre</span>
      )}
    </>
  );

  const className = cn(
    "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-1 text-center transition active:scale-95",
    tone,
    hasAlert && "animate-pulse"
  );

  if (hasAlert) {
    return (
      <button type="button" onClick={onOpenAlerts} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={`/garcom/mesa/${table.qrToken}` as any} className={className}>
      {content}
    </Link>
  );
}
