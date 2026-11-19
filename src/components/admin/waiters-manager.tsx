"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Waiter } from "./types";
import { Field } from "./field";

export function WaitersManager() {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const loadWaiters = useCallback(async () => {
    const res = await fetch("/api/waiters", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { waiters?: Waiter[] };
      setWaiters(data.waiters ?? []);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(loadWaiters, 0);
  }, [loadWaiters]);

  async function handleAddWaiter(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      setIsError(true);
      setFeedback("Nome e senha de acesso são obrigatórios.");
      return;
    }
    setLoading(true);
    setFeedback(null);
    setIsError(false);

    const res = await fetch("/api/waiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    setLoading(false);
    if (res.ok) {
      setName("");
      setEmail("");
      setPassword("");
      setIsError(false);
      setFeedback("Garçom cadastrado com sucesso!");
      await loadWaiters();
    } else {
      const err = await res.json().catch(() => ({}));
      setIsError(true);
      setFeedback(err.error || "Erro ao cadastrar garçom.");
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Cadastrar Garçom da Equipe</h2>
        <p className="text-xs text-zinc-500 mb-4">Adicione garçons com senha para que eles acessem o painel de mesas.</p>
        <form onSubmit={handleAddWaiter} className="space-y-3">
          <Field label="Nome do Garçom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" required />
          </Field>
          <Field label="Senha de Acesso (Mín. 4 dígitos)">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite uma senha exclusiva..."
              required
            />
          </Field>
          <Field label="Email ou Identificador (Opcional)">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex.: joao@lendas.local" />
          </Field>
          <Button className="w-full font-bold" type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar Garçom"}
          </Button>
          {feedback && (
            <p className={cn("text-xs text-center font-medium", isError ? "text-red-400" : "text-emerald-300")}>
              {feedback}
            </p>
          )}
        </form>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Equipe Cadastrada ({waiters.length})</h2>
        <p className="text-xs text-zinc-500 mb-4">Garçons ativos no salão.</p>
        <div className="space-y-2">
          {waiters.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div>
                <p className="font-bold text-white text-sm">👤 {w.name}</p>
                <p className="text-zinc-400">Mesas: {w.tables}</p>
              </div>
              <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Ativo</Badge>
            </div>
          ))}
          {waiters.length === 0 && <p className="text-xs text-zinc-500">Nenhum garçom cadastrado ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
