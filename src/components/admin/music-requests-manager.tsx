"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MusicRequest = {
  id: string;
  table: string;
  customerName: string;
  title: string;
  artist: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  playedAt: string | null;
};

export function MusicRequestsManager() {
  const [requests, setRequests] = useState<MusicRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    const response = await fetch("/api/music-requests", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as { requests?: MusicRequest[] };
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    window.setTimeout(async () => {
      await loadRequests();
      setLoading(false);
    }, 0);
    const interval = window.setInterval(loadRequests, 5000);
    return () => window.clearInterval(interval);
  }, [loadRequests]);

  async function markPlayed(id: string) {
    const response = await fetch(`/api/music-requests/${id}/played`, { method: "POST" });
    if (!response.ok) return;
    await loadRequests();
  }

  const openRequests = requests.filter((request) => request.status === "OPEN");
  const playedRequests = requests.filter((request) => request.status === "PLAYED");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Pedidos de musica</p>
            <h2 className="mt-1 text-lg font-semibold">Fila da cabine</h2>
          </div>
          <Badge className="border-red-500/30 bg-red-500/10 text-red-100">{openRequests.length} abertos</Badge>
        </div>

        {loading && <p className="text-sm text-zinc-500">Carregando pedidos...</p>}

        <div className="space-y-3">
          {openRequests.length === 0 && !loading && <p className="text-sm text-zinc-500">Nenhum pedido de musica aberto.</p>}
          {openRequests.map((request) => (
            <div key={request.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-red-300">{request.table}</p>
                  <h3 className="mt-1 text-lg font-semibold">{request.title}</h3>
                  <p className="text-sm text-zinc-400">{request.artist || "Artista nao informado"}</p>
                  <p className="mt-2 text-sm text-zinc-500">{request.customerName}</p>
                </div>
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-100">Aguardando</Badge>
              </div>

              {request.notes && <p className="mt-3 rounded-md border border-white/10 bg-black/40 p-3 text-sm text-zinc-300">{request.notes}</p>}

              <Button className="mt-4 w-full" onClick={() => markPlayed(request.id)}>
                Marcar como tocada
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="mb-4 text-lg font-semibold">Historico recente</h2>
        <div className="space-y-3">
          {playedRequests.length === 0 && <p className="text-sm text-zinc-500">Nenhuma musica marcada como tocada ainda.</p>}
          {playedRequests.slice(0, 8).map((request) => (
            <div key={request.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-semibold">{request.title}</p>
              <p className="text-xs text-zinc-500">{request.table} · {request.customerName}</p>
              <p className="mt-2 text-xs text-emerald-300">Tocada</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
