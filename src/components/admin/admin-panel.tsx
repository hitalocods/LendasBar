"use client";

import Image from "next/image";
import Link from "next/link";
import { Boxes, ChefHat, Grid2X2, LayoutDashboard, LogOut, Music2, Printer, UserPlus, Utensils } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminView } from "./types";
import { DashboardOverview } from "./dashboard-overview";
import { KitchenOrdersManager } from "./kitchen-orders-manager";
import { CategoriesManager } from "./categories-manager";
import { MenuManager } from "./menu-manager";
import { MusicRequestsManager } from "./music-requests-manager";
import { TablesAndQr } from "./tables-and-qr";
import { WaiterCallsHeader } from "./waiter-calls-header";
import { WaitersManager } from "./waiters-manager";

export function AdminPanel() {
  const [activeView, setActiveView] = useState<AdminView>("dashboard");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/admin";
  }

  return (
    <main className="noise min-h-screen bg-background p-3 sm:p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[230px_1fr] lg:grid-cols-[250px_1fr]">
        <aside className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/55 p-4 md:min-h-[calc(100vh-3rem)] md:sticky md:top-6">
          <div>
            <div className="mb-5 md:mb-8 flex items-center justify-between md:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 md:h-12 md:w-12 overflow-hidden rounded-full border border-red-500/40">
                  <Image src="/lendas-logo.png" alt="LENDAS 2018" fill sizes="48px" className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">LENDAS 2018</p>
                  <p className="text-xs text-zinc-400">Painel do Dono</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="md:hidden text-red-300 hover:bg-red-500/10 text-xs">
                <LogOut className="mr-1 h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
            <nav className="grid grid-cols-2 min-[520px]:grid-cols-3 md:flex md:flex-col gap-1 text-sm text-zinc-400">
              {[
                [LayoutDashboard, "Visão Geral", "dashboard"],
                [ChefHat, "Cozinha & Pedidos", "pedidos"],
                [Boxes, "Cardápio e Produtos", "cardapio"],
                [Grid2X2, "Categorias", "categorias"],
                [Printer, "Mesas & QR Codes", "qrcodes"],
                [UserPlus, "Garçons & Equipe", "equipe"],
                [Music2, "Pedidos de Música", "musica"]
              ].map(([Icon, label, view]) => (
                <button
                  key={label as string}
                  onClick={() => setActiveView(view as AdminView)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition text-xs sm:text-sm hover:bg-white/[0.06]",
                    activeView === view && "bg-red-600 text-white font-bold shadow-md hover:bg-red-600"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label as string}</span>
                </button>
              ))}
            </nav>
            <div className="pt-4 border-t border-white/10 mt-4">
              <Button asChild variant="outline" className="w-full justify-start text-amber-300 border-amber-500/30 hover:bg-amber-500/10 text-xs font-bold gap-2 h-10">
                <Link href={"/garcom" as any}>
                  <Utensils className="h-4 w-4 text-amber-400" />
                  Ir ao Painel do Garçom
                </Link>
              </Button>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="mt-6 hidden md:flex w-full justify-start text-red-300 hover:bg-red-500/10">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </aside>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-400 font-bold">Painel de Controle</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {activeView === "dashboard" && "Visão Geral do Bar"}
                {activeView === "pedidos" && "Fila da Cozinha & Bar (KDS)"}
                {activeView === "cardapio" && "Cardápio e Produtos"}
                {activeView === "categorias" && "Gestão de Categorias"}
                {activeView === "qrcodes" && "Mesas e Placas QR Code"}
                {activeView === "equipe" && "Cadastrar Garçons & Equipe"}
                {activeView === "musica" && "Fila da Cabine de Música"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-emerald-300 font-bold">
                ● Salão Aberto
              </Badge>
            </div>
          </div>

          <WaiterCallsHeader />

          {activeView === "dashboard" && (
            <DashboardOverview onNavigate={(view) => setActiveView(view as AdminView)} />
          )}
          {activeView === "pedidos" && <KitchenOrdersManager />}
          {activeView === "cardapio" && <MenuManager />}
          {activeView === "categorias" && <CategoriesManager />}
          {activeView === "qrcodes" && <TablesAndQr />}
          {activeView === "equipe" && <WaitersManager />}
          {activeView === "musica" && <MusicRequestsManager />}
        </section>
      </div>
    </main>
  );
}
