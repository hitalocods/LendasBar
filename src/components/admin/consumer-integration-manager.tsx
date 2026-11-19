"use client";

import { Copy, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ConsumerIntegrationManager() {
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [permanentCount, setPermanentCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);

  const pollingUrl = `${origin}/api/integrations/consumer/events`;
  const orderDetailsUrl = `${origin}/api/integrations/consumer/orders/{id}`;
  const webhookUrl = `${origin}/api/integrations/consumer/webhook`;

  const checkPending = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/consumer/resync", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { pendingCount?: number; permanentCount?: number };
        setPendingCount(data.pendingCount ?? 0);
        setPermanentCount(data.permanentCount ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(checkPending, 0);
    const interval = window.setInterval(checkPending, 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [checkPending]);

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  async function handleResync() {
    setResyncing(true);
    try {
      const res = await fetch("/api/integrations/consumer/resync", { method: "POST" });
      if (res.ok) {
        await checkPending();
      }
    } finally {
      setResyncing(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/consumer/events", { cache: "no-store" });
      if (res.ok) {
        setTestResult({
          success: true,
          message: "Conexão com a API de Parceiros do Consumer testada com sucesso (Código 200 OK)."
        });
      } else {
        setTestResult({
          success: false,
          message: `Falha ao testar API: HTTP ${res.status}`
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Erro de rede ao testar os endpoints da integração."
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      {permanentCount > 0 && (
        <Card className="border-red-500/50 bg-gradient-to-r from-red-950/80 via-black to-zinc-950 p-4 text-red-200 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-red-400">
                🛑 Intervenção Manual Necessária (Falha Permanente)
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Existem {permanentCount} {permanentCount === 1 ? "pedido" : "pedidos"} que atingiram o limite máximo de 5 tentativas de envio
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Verifique se o código do produto (Código Consumer) está correto no cadastro do cardápio.
              </p>
            </div>
          </div>
        </Card>
      )}

      {pendingCount > 0 && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-black to-zinc-950 p-4 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">
              🚨 Alerta de Sincronização
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">
              Existem {pendingCount} {pendingCount === 1 ? "pedido pendente" : "pedidos pendentes"} de sincronização com o Consumer
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Estes pedidos estão agendados para retry automático a cada 5 minutos via Cron ou clique manual.
            </p>
          </div>
          <Button onClick={handleResync} disabled={resyncing} className="bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs">
            {resyncing ? "Re-enviando..." : "Re-sincronizar Agora"}
          </Button>
        </Card>
      )}

      <Card className="border-white/10 bg-black/45 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="mb-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              API Oficial de Parceiros Consumer (Homologado)
            </Badge>
            <h2 className="text-xl font-bold">Integração Programa Consumer (PDV)</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Protocolo B2B oficial com suporte a Polling de Eventos, Detalhes de Pedido (INDOOR / Mesa) e Webhook.
            </p>
          </div>
          <Button variant="secondary" onClick={handleTestConnection} disabled={testing} className="font-bold text-xs gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            {testing ? "Testando..." : "Testar Conexão"}
          </Button>
        </div>

        {testResult && (
          <div className={cn("mt-4 rounded-lg border p-3 text-xs font-medium", testResult.success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200")}>
            {testResult.message}
          </div>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-white/10 bg-black/45 p-4 space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">1. Polling de Eventos (GET)</span>
            <h3 className="text-sm font-semibold mt-0.5">Consulta de Eventos</h3>
            <p className="text-xs text-zinc-400 mt-1">O Consumer consulta esta URL a cada poucos segundos para buscar novos pedidos.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950 p-2 text-xs font-mono text-zinc-300">
            <span className="truncate flex-1">{pollingUrl}</span>
            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(pollingUrl, "polling")} className="h-7 px-2">
              {copiedUrl === "polling" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-black/45 p-4 space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">2. Detalhes do Pedido (GET)</span>
            <h3 className="text-sm font-semibold mt-0.5">Consulta de Detalhes</h3>
            <p className="text-xs text-zinc-400 mt-1">URL usada pelo Consumer para puxar o JSON com itens, mesa e cliente.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950 p-2 text-xs font-mono text-zinc-300">
            <span className="truncate flex-1">{orderDetailsUrl}</span>
            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(orderDetailsUrl, "details")} className="h-7 px-2">
              {copiedUrl === "details" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-black/45 p-4 space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">3. Webhook Callback (POST)</span>
            <h3 className="text-sm font-semibold mt-0.5">Atualização de Status</h3>
            <p className="text-xs text-zinc-400 mt-1">O Consumer avisa esta URL quando o pedido for aceito, em preparo ou pronto.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950 p-2 text-xs font-mono text-zinc-300">
            <span className="truncate flex-1">{webhookUrl}</span>
            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(webhookUrl, "webhook")} className="h-7 px-2">
              {copiedUrl === "webhook" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
