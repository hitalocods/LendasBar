"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Boxes, Camera, Grid2X2, LogOut, Music2, Pencil, Printer, Search, ToggleLeft, ToggleRight, Trash2, Upload, WalletCards, Copy, Check, UserPlus, Bell, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";

type AdminView = "cardapio" | "categorias" | "qrcodes" | "equipe" | "musica" | "consumer";
type Product = {
  id: string;
  name: string;
  desc: string;
  category: string;
  price: number;
  imageUrl?: string;
  consumerCode?: string | null;
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
type Waiter = {
  id: string;
  name: string;
  tables: string;
};

export function AdminPanel() {
  const [activeView, setActiveView] = useState<AdminView>("cardapio");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login?next=/admin";
  }

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col justify-between rounded-lg border border-white/10 bg-black/55 p-4 min-h-[calc(100vh-3rem)]">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-red-500/40">
                <Image src="/lendas-logo.png" alt="LENDAS 2018" fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold">LENDAS 2018</p>
                <p className="text-xs text-zinc-500">Proprietario</p>
              </div>
            </div>
            <nav className="space-y-1 text-sm text-zinc-400">
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
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition hover:bg-white/[0.06]",
                    activeView === view && "bg-red-600 text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label as string}
                </button>
              ))}
            </nav>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="mt-6 w-full justify-start text-red-300 hover:bg-red-500/10">
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

function TablesAndQr() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selectedTable, setSelectedTable] = useState("1");
  const qrCardRef = useRef<HTMLDivElement>(null);
  const [appBaseUrl] = useState(() => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, ""));
  const [brandHandle] = useState(() => process.env.NEXT_PUBLIC_BRAND_HANDLE || "@atlassoftware_");
  const [marketingCopy] = useState(() => process.env.NEXT_PUBLIC_MARKETING_COPY || "Peça direto no QR e viva a experiência LENDAS.");

  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied" | "bill">("all");

  const selectedTableUrl = useMemo(() => {
    if (!appBaseUrl) return `https://lendasbar.vercel.app/mesa/${selectedTable}`;
    return `${appBaseUrl}/mesa/${selectedTable}`;
  }, [appBaseUrl, selectedTable]);

  const loadTables = useCallback(async () => {
    const [tablesResponse, waitersResponse] = await Promise.all([
      fetch("/api/tables", { cache: "no-store" }),
      fetch("/api/waiters", { cache: "no-store" })
    ]);

    if (tablesResponse.ok) {
      const data = (await tablesResponse.json()) as { tables?: TableRow[] };
      const rows = data.tables ?? [];
      setTables(rows);
      if (rows.length && !rows.some((table) => table.qrToken === selectedTable)) {
        setSelectedTable(rows[0].qrToken);
      }
    }

    if (waitersResponse.ok) {
      const data = (await waitersResponse.json()) as { waiters?: Waiter[] };
      setWaiters(data.waiters ?? []);
    }
  }, [selectedTable]);

  useEffect(() => {
    window.setTimeout(loadTables, 0);
    const interval = window.setInterval(loadTables, 5000);
    return () => window.clearInterval(interval);
  }, [loadTables]);

  async function closeTable(token: string) {
    await fetch(`/api/tables/${token}/close`, { method: "POST" });
    await loadTables();
  }

  async function assignWaiter(token: string, waiterId: string) {
    await fetch(`/api/tables/${token}/assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: waiterId || null })
    });
    await loadTables();
  }

  function printQrCode() {
    if (!selectedTableUrl || !qrCardRef.current) return;

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) return;

    const qrMarkup = qrCardRef.current.innerHTML;
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Mesa ${selectedTable}</title>
          <style>
            @page { size: auto; margin: 14mm; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111;
              display: grid;
              place-items: center;
              min-height: 100vh;
              background: #fff;
            }
            .print-card {
              width: 360px;
              padding: 24px;
              border: 2px solid #111;
              border-radius: 20px;
              text-align: center;
            }
            .print-card h1 {
              margin: 0 0 8px;
              font-size: 22px;
            }
            .print-card p {
              margin: 0 0 18px;
              font-size: 14px;
            }
            .brand {
              margin-bottom: 6px;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #d71920;
            }
            .marketing {
              margin-top: 8px;
              font-size: 13px;
              color: #333;
            }
            .qr-box {
              display: grid;
              place-items: center;
              margin: 0 auto 16px;
              padding: 16px;
              background: #fff;
            }
            .qr-box svg {
              width: 220px !important;
              height: 220px !important;
            }
            .footer {
              font-size: 12px;
              color: #555;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="print-card">
            <div class="brand">${brandHandle}</div>
            <h1>Mesa ${selectedTable.padStart(2, "0")}</h1>
            <p>Aponte a camera para abrir o cardapio</p>
            <div class="qr-box">${qrMarkup}</div>
            <div class="marketing">${marketingCopy}</div>
            <div class="footer">${selectedTableUrl}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  const displayTables = tables.length
    ? tables
    : Array.from({ length: 30 }, (_, index) => ({
        id: String(index + 1),
        number: index + 1,
        qrToken: String(index + 1),
        status: "AVAILABLE",
        sessionId: null,
        waiter: null,
        guests: [],
        total: 0
      }));

  function printAllQrCodes() {
    if (typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "width=1000,height=1200");
    if (!printWindow) return;

    const origin = window.location.origin;
    const cardsHtml = displayTables
      .map((table) => {
        const url = `${origin}/mesa/${table.qrToken}`;
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
        return `
          <div class="print-card">
            <div class="brand">LENDAS 2018</div>
            <h1>Mesa ${table.number.toString().padStart(2, "0")}</h1>
            <p>Aponte a câmera do celular para abrir o cardápio</p>
            <div class="qr-box">
              <img src="${qrImageUrl}" width="200" height="200" alt="QR Mesa ${table.number}" />
            </div>
            <div class="marketing">Faça seu pedido diretamente da mesa!</div>
            <div class="footer">${url}</div>
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Todos os QR Codes das Mesas - LENDAS 2018</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111;
              background: #fff;
            }
            .grid-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12mm;
              padding: 5mm;
            }
            .print-card {
              border: 2px solid #111;
              border-radius: 16px;
              padding: 16px;
              text-align: center;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .print-card h1 {
              margin: 0 0 6px;
              font-size: 22px;
              font-weight: 800;
            }
            .print-card p {
              margin: 0 0 10px;
              font-size: 12px;
              color: #444;
            }
            .brand {
              margin-bottom: 4px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #d71920;
            }
            .marketing {
              margin-top: 8px;
              font-size: 11px;
              color: #333;
              font-weight: 600;
            }
            .qr-box {
              display: grid;
              place-items: center;
              margin: 0 auto 8px;
              padding: 8px;
              background: #fff;
            }
            .footer {
              font-size: 10px;
              color: #666;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  const filteredTables = useMemo(() => {
    return displayTables.filter((table) => {
      if (statusFilter === "available") return !table.sessionId;
      if (statusFilter === "occupied") return Boolean(table.sessionId && table.status !== "WAITING_BILL");
      if (statusFilter === "bill") return table.status === "WAITING_BILL";
      return true;
    });
  }, [displayTables, statusFilter]);

  const occupiedCount = displayTables.filter((t) => t.sessionId).length;
  const availableCount = displayTables.length - occupiedCount;
  const billCount = displayTables.filter((t) => t.status === "WAITING_BILL").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-semibold">Painel de Mesas — Estilo Consumer ({displayTables.length})</h2>
            <p className="text-xs text-zinc-500">Visão em bloco com identificação do garçom, valor e status do caixa.</p>
          </div>
          <Button variant="outline" size="sm" onClick={printAllQrCodes} className="gap-1.5 border-white/20 text-xs font-semibold hover:bg-white/10">
            <Printer className="h-4 w-4 text-red-400" />
            Imprimir Todos QR Codes
          </Button>
        </div>

        {/* Filtros de Status (Estilo Caixa Consumer) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "secondary"}
            onClick={() => setStatusFilter("all")}
            className="text-xs h-8"
          >
            Todas ({displayTables.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "available" ? "default" : "secondary"}
            onClick={() => setStatusFilter("available")}
            className="text-xs h-8 border border-emerald-500/40 text-emerald-300"
          >
            Livres ({availableCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "occupied" ? "default" : "secondary"}
            onClick={() => setStatusFilter("occupied")}
            className="text-xs h-8 border border-red-500/40 text-red-300"
          >
            Ocupadas ({occupiedCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "bill" ? "default" : "secondary"}
            onClick={() => setStatusFilter("bill")}
            className="text-xs h-8 border border-amber-500/40 text-amber-300"
          >
            Pedindo Conta ({billCount})
          </Button>
        </div>

        {/* Grid de Mesas Estilo Consumer */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredTables.map((table) => {
            const isOccupied = Boolean(table.sessionId);
            const isWaitingBill = table.status === "WAITING_BILL";

            return (
              <div
                key={table.id}
                onClick={() => setSelectedTable(table.qrToken)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-3.5 transition cursor-pointer select-none min-h-[145px]",
                  isWaitingBill
                    ? "border-amber-500/80 bg-amber-950/40 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse"
                    : isOccupied
                    ? "border-red-500/60 bg-gradient-to-b from-red-950/40 to-zinc-950 text-white shadow-md hover:border-red-400"
                    : "border-emerald-500/30 bg-emerald-950/20 text-zinc-300 hover:border-emerald-500/60"
                )}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                    <span className="font-extrabold text-base tracking-wide">Mesa {table.number.toString().padStart(2, "0")}</span>
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 font-bold uppercase",
                        isWaitingBill
                          ? "bg-amber-500 text-black"
                          : isOccupied
                          ? "bg-red-500 text-white"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      )}
                    >
                      {isWaitingBill ? "Pedindo Conta" : isOccupied ? "Ocupada" : "Livre"}
                    </Badge>
                  </div>

                  {/* Seletor do Garçom com destaque */}
                  <div className="mb-2">
                    <select
                      value={table.waiter?.id ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(event) => assignWaiter(table.qrToken, event.target.value)}
                      className="w-full text-[11px] h-7 rounded bg-black/70 border border-white/15 px-1.5 text-zinc-200 focus:outline-none focus:border-red-500 truncate"
                    >
                      <option value="">👤 Sem garçom</option>
                      {waiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          👤 {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Valor Total & Clientes */}
                  {isOccupied ? (
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-300 truncate font-medium">
                        👥 {table.guests.length ? table.guests.join(", ") : "Clientes na mesa"}
                      </p>
                      <p className="text-lg font-black text-emerald-400">
                        {formatCurrency(table.total / 100)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-400/80 font-medium">Livre / QR Ativo</p>
                  )}
                </div>

                {/* Ação do Caixa */}
                {isOccupied && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTable(table.qrToken);
                    }}
                    className="mt-3 w-full h-7 text-xs bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 font-semibold"
                  >
                    Fechar Mesa
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="mb-1 text-lg font-semibold">Gerar QR Code</h2>
        <p className="mb-4 text-sm text-zinc-500">Selecione a mesa e imprima o acesso do cliente.</p>
        <Input className="mb-4" value={selectedTable} onChange={(event) => setSelectedTable(event.target.value)} placeholder="Numero/token da mesa" />
        <div ref={qrCardRef} className="grid gap-4 rounded-md bg-white p-4 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-red-600">{brandHandle}</div>
          <div className="grid place-items-center">
            <QRCodeSVG value={selectedTableUrl} size={180} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Mesa {selectedTable.padStart(2, "0")}</p>
            <p className="text-xs text-zinc-500 break-all">{selectedTableUrl}</p>
            <p className="mt-2 text-sm text-zinc-700">{marketingCopy}</p>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={printQrCode} disabled={!selectedTableUrl && !selectedTable}>
          Imprimir QR Code
        </Button>
      </Card>
    </div>
  );
}

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

function MusicRequestsManager() {
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
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
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

function ConsumerIntegrationManager() {
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const pollingUrl = `${origin}/api/integrations/consumer/events`;
  const orderDetailsUrl = `${origin}/api/integrations/consumer/orders/{id}`;
  const webhookUrl = `${origin}/api/integrations/consumer/webhook`;

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
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

function MenuManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Hamburgueres",
    price: "",
    imageUrl: "",
    consumerCode: ""
  });

  async function loadProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { products?: Product[] };
    setProducts(data.products ?? []);
  }

  useEffect(() => {
    window.setTimeout(loadProducts, 0);
  }, []);

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price.replace(",", "."))
      })
    });

    if (!response.ok) return;

    setEditingId(null);
    setForm({ name: "", description: "", category: form.category, price: "", imageUrl: "", consumerCode: "" });
    await loadProducts();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) {
          setForm((prev) => ({ ...prev, imageUrl: data.url! }));
        }
      }
    } finally {
      setUploadingImage(false);
    }
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.desc,
      category: product.category,
      price: String(product.price).replace(".", ","),
      imageUrl: product.imageUrl ?? "",
      consumerCode: product.consumerCode ?? ""
    });
  }

  async function removeProduct(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await loadProducts();
  }

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <Card className="border-white/10 bg-black/45 p-0">
        <div className="border-b border-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-red-300">Produto</p>
          <h2 className="mt-1 text-lg font-semibold">{editingId ? "Editar produto" : "Adicionar produto"}</h2>
        </div>
        <div className="p-4">
          <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
            <div className="relative grid aspect-[16/10] place-items-center bg-gradient-to-br from-red-950/40 to-zinc-950">
              {form.imageUrl ? (
                <Image src={form.imageUrl} alt="Preview do produto" fill sizes="(max-width: 1280px) 100vw, 390px" className="object-cover" />
              ) : (
                <div className="text-center text-zinc-500">
                  <Camera className="mx-auto mb-2 h-8 w-8 text-red-300" />
                  <p className="text-sm">Preview da foto</p>
                </div>
              )}
            </div>
          </div>
        <form className="space-y-3" onSubmit={submitProduct}>
          <Field label="Nome">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Hamburguer Lendas" />
          </Field>
          <Field label="Descricao">
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Blend da casa, cheddar e molho especial" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Hamburgueres" />
            </Field>
            <Field label="Preco">
              <Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="29,90" />
            </Field>
          </div>
          <Field label="Codigo Consumer (ID PDV)">
            <Input value={form.consumerCode} onChange={(event) => setForm({ ...form, consumerCode: event.target.value })} placeholder="Ex: 104 ou BEB-01" />
          </Field>
          <Field label="Foto do Produto">
            <div className="space-y-2">
              <Input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://... ou faça upload" />
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              <Button type="button" variant="secondary" size="sm" className="w-full" disabled={uploadingImage} onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {uploadingImage ? "Enviando Imagem..." : "Upload do Computador/Celular"}
              </Button>
            </div>
          </Field>
          <Button className="w-full" type="submit">{editingId ? "Salvar alteracoes" : "Cadastrar produto"}</Button>
          {editingId && (
            <Button className="w-full" type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancelar edicao
            </Button>
          )}
        </form>
        </div>
      </Card>

      <Card className="border-white/10 bg-black/45 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-300">Cardapio</p>
            <h2 className="mt-1 text-lg font-semibold">Produtos cadastrados</h2>
          </div>
          <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <Input className="border-0 bg-transparent px-0 focus:ring-0" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto..." />
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {visibleProducts.map((product) => (
            <div key={product.id} className="group flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:border-red-500/40">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="96px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{product.desc}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <Badge>{product.category}</Badge>
                    <p className="mt-2 text-sm font-semibold text-red-300">{formatCurrency(product.price)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="secondary" onClick={() => editProduct(product)} aria-label="Editar produto">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => removeProduct(product.id)} aria-label="Remover produto">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type CategoryItem = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/categories", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { categories?: CategoryItem[] };
    setCategories(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    window.setTimeout(loadCategories, 0);
  }, [loadCategories]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), sortOrder: Number(sortOrder) || 0 })
    });
    setName("");
    setSortOrder("0");
    setSaving(false);
    await loadCategories();
  }

  async function toggleCategory(id: string, currentActive: boolean) {
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !currentActive })
    });
    await loadCategories();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Nova Categoria</h2>
        <p className="text-xs text-zinc-500 mb-4">Adicione categorias para organizar o cardapio.</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Nome da Categoria">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Drinks Especiais" />
          </Field>
          <Field label="Ordem de Exibicao">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
          </Field>
          <Button className="w-full" type="submit" disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Criar Categoria"}
          </Button>
        </form>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Categorias Cadastradas</h2>
        <p className="text-xs text-zinc-500 mb-4">Gerencie as categorias ativas e a ordem no aplicativo.</p>

        {loading && <p className="text-sm text-zinc-500">Carregando categorias...</p>}

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.035] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{cat.name}</p>
                <p className="text-xs text-zinc-500">Ordem: {cat.sortOrder} · {cat.productCount} produtos vinculados</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={cat.active ? "secondary" : "outline"}
                  onClick={() => toggleCategory(cat.id, cat.active)}
                  className="text-xs"
                >
                  {cat.active ? <ToggleRight className="mr-1 h-4 w-4 text-emerald-400" /> : <ToggleLeft className="mr-1 h-4 w-4 text-zinc-500" />}
                  {cat.active ? "Ativa" : "Inativa"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

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

function WaiterCallsHeader() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCallsCountRef = useRef(0);

  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

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
  }, [playChime, soundEnabled]);

  useEffect(() => {
    window.setTimeout(loadCalls, 0);
    const interval = window.setInterval(loadCalls, 4000);
    return () => window.clearInterval(interval);
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

function WaitersManager() {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    if (!name.trim()) return;
    setLoading(true);
    setFeedback(null);

    const res = await fetch("/api/waiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });

    setLoading(false);
    if (res.ok) {
      setName("");
      setEmail("");
      setFeedback("Garçom cadastrado com sucesso!");
      await loadWaiters();
    } else {
      setFeedback("Erro ao cadastrar garçom.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Cadastrar Garçom da Equipe</h2>
        <p className="text-xs text-zinc-500 mb-4">Adicione garçons para vinculá-los às mesas do salão.</p>
        <form onSubmit={handleAddWaiter} className="space-y-3">
          <Field label="Nome do Garçom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" />
          </Field>
          <Field label="Email ou Identificador (Opcional)">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex.: joao@lendas.local" />
          </Field>
          <Button className="w-full font-bold" type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar Garçom"}
          </Button>
          {feedback && <p className="text-xs text-emerald-300 text-center font-medium">{feedback}</p>}
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
