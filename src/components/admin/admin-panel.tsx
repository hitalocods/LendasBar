"use client";

import Image from "next/image";
import { Boxes, Grid2X2, LogOut, Music2, Printer, WalletCards, UserPlus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminView } from "./types";
import { CategoriesManager } from "./categories-manager";
import { ConsumerIntegrationManager } from "./consumer-integration-manager";
import { MenuManager } from "./menu-manager";
import { MusicRequestsManager } from "./music-requests-manager";
import { TablesAndQr } from "./tables-and-qr";
import { WaiterCallsHeader } from "./waiter-calls-header";
import { WaitersManager } from "./waiters-manager";

export function AdminPanel() {
  const [activeView, setActiveView] = useState<AdminView>("cardapio");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/admin";
  }

  return (
    <main className="noise min-h-screen bg-background p-3 sm:p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/55 p-4 md:min-h-[calc(100vh-3rem)] md:sticky md:top-6">
          <div>
            <div className="mb-5 md:mb-8 flex items-center justify-between md:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 md:h-12 md:w-12 overflow-hidden rounded-full border border-red-500/40">
                  <Image src="/lendas-logo.png" alt="LENDAS 2018" fill sizes="48px" className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold">LENDAS 2018</p>
                  <p className="text-xs text-zinc-500">Proprietario</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="md:hidden text-red-300 hover:bg-red-500/10 text-xs">
                <LogOut className="mr-1 h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
            <nav className="grid grid-cols-2 min-[520px]:grid-cols-3 md:flex md:flex-col gap-1 text-sm text-zinc-400">
              {[
                [Boxes, "Cardapio e Produtos", "cardapio"],
                [Grid2X2, "Categorias", "categorias"],
                [Printer, "QR Codes das Mesas", "qrcodes"],
                [UserPlus, "Garcons & Equipe", "equipe"],
                [Music2, "Pedidos de Musica", "musica"],
                [WalletCards, "Consumer (PDV)", "consumer"]
              ].map(([Icon, label, view]) => (
                <button
                  key={label as string}
                  onClick={() => setActiveView(view as AdminView)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition text-xs sm:text-sm hover:bg-white/[0.06]",
                    activeView === view && "bg-red-600 text-white font-medium"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label as string}</span>
                </button>
              ))}
            </nav>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="mt-6 hidden md:flex w-full justify-start text-red-300 hover:bg-red-500/10">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </aside>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Painel administrativo</p>
              <h1 className="text-2xl font-semibold">
                {activeView === "cardapio" && "Cardapio e produtos"}
                {activeView === "categorias" && "Gestao de categorias"}
                {activeView === "qrcodes" && "Placas e QR Codes das Mesas"}
                {activeView === "equipe" && "Cadastrar Garcons & Equipe"}
                {activeView === "musica" && "Fila da Cabine de Musica"}
                {activeView === "consumer" && "Integracao Consumer (PDV)"}
              </h1>
            </div>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">Aberto agora</Badge>
          </div>

          <WaiterCallsHeader />

          {activeView === "cardapio" && <MenuManager />}
          {activeView === "categorias" && <CategoriesManager />}
          {activeView === "qrcodes" && <TablesAndQr />}
          {activeView === "equipe" && <WaitersManager />}
          {activeView === "musica" && <MusicRequestsManager />}
          {activeView === "consumer" && <ConsumerIntegrationManager />}
        </section>
      </div>
    </main>
  );
}
