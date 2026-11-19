"use client";

import { Bell, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { playChime } from "@/lib/chime";

type ActiveCall = {
  id: string;
  table: string;
  tableNumber: number;
  customerName: string;
  type: "WAITER" | "BILL";
  status: string;
  waiter: { id: string; name: string } | null;
  minutes: number;
};

export function WaiterCallsHeader() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCallsCountRef = useRef(0);

  const loadCalls = useCallback(async () => {
    const res = await fetch("/api/waiter-calls", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { calls?: ActiveCall[] };
    const activeCalls = data.calls ?? [];

    if (activeCalls.length > previousCallsCountRef.current && soundEnabled) {
      playChime();
    }
    previousCallsCountRef.current = activeCalls.length;
    setCalls(activeCalls);
  }, [soundEnabled]);

  useEffect(() => {
    window.setTimeout(loadCalls, 0);
    let interval = window.setInterval(loadCalls, 4000);

    function handleVisibilityChange() {
      if (document.hidden) {
        window.clearInterval(interval);
      } else {
        loadCalls().catch(() => {});
        interval = window.setInterval(loadCalls, 4000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadCalls]);

  async function handleResolve(id: string) {
    await fetch(`/api/waiter-calls/${id}/resolve`, { method: "POST" });
    await loadCalls();
  }

  if (calls.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-950/40 p-4 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-amber-500/20 pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-400 animate-bounce" />
          <span className="font-bold text-sm tracking-wide">
            CHAMADOS ATIVOS NO SALÃO ({calls.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-xs gap-1 text-amber-300 hover:bg-amber-500/20"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {soundEnabled ? "Som Ativo" : "Mudo"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {calls.map((call) => (
          <div
            key={call.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-black/60 p-3 text-xs"
          >
            <div>
              <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                <span>{call.table}</span>
                <Badge className={cn("text-[10px] px-1.5", call.type === "BILL" ? "bg-amber-500 text-black" : "bg-red-600 text-white")}>
                  {call.type === "BILL" ? "💳 Pedindo Conta" : "🚨 Chamar Garçom"}
                </Badge>
              </div>
              <p className="text-zinc-400 mt-1">
                Cliente: <strong className="text-zinc-200">{call.customerName}</strong>
              </p>
              <p className="text-amber-300/90 font-medium">
                👤 Garçom: {call.waiter?.name || "Sem garçom atribuído"}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-8 px-2.5 shrink-0"
              onClick={() => handleResolve(call.id)}
            >
              Atendido
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
