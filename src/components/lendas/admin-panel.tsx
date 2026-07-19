"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { BarChart3, Boxes, Camera, Clock, Grid2X2, KeyRound, LogOut, Music2, Pencil, Printer, ReceiptText, Search, Settings, ShieldCheck, ShoppingBag, ToggleLeft, ToggleRight, Trash2, Upload, UserPlus, Users, WalletCards, Copy, ExternalLink, Check } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { useLendasStore } from "@/store/lendas-store";

type AdminView = "dashboard" | "cardapio" | "categorias" | "mesas" | "equipe" | "pedidos" | "musica" | "financeiro" | "configuracoes";
type Product = {
  id: string;
  name: string;
  desc: string;
  category: string;
  price: number;
  imageUrl?: string;
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
type FinanceSummary = {
  from: string;
  to: string;
  revenueCents: number;
  expensesCents: number;
  netCents: number;
  deliveredOrders: number;
};
type Expense = {
  id: string;
  description: string;
  category: string | null;
  amountCents: number;
  occurredAt: string;
  createdAt: string;
};

export function AdminPanel() {
  const { orders, waiterCalls, billRequests } = useLendasStore();
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const activeOrders = orders.filter((order) => order.status !== "Entregue").length;
  const revenue = orders.reduce((total, order) => total + order.total, 0);

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
                [BarChart3, "Dashboard", "dashboard"],
                [Boxes, "Cardapio", "cardapio"],
                [Grid2X2, "Categorias", "categorias"],
                [Users, "Mesas", "mesas"],
                [UserPlus, "Garcons & Equipe", "equipe"],
                [ReceiptText, "Pedidos", "pedidos"],
                [WalletCards, "Financeiro", "financeiro"],
                [Music2, "Musica", "musica"],
                [Settings, "Configuracoes", "configuracoes"]
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
                {activeView === "equipe" && "Cadastrar Garcons & Equipe"}
                {activeView === "pedidos" && "Historico de pedidos"}
                {activeView === "configuracoes" && "Configuracoes do restaurante"}
                {activeView !== "cardapio" && activeView !== "categorias" && activeView !== "equipe" && activeView !== "pedidos" && activeView !== "configuracoes" && "Gestao do restaurante"}
              </h1>
            </div>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">Aberto agora</Badge>
          </div>

          {activeView === "dashboard" && (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric icon={ShoppingBag} label="Pedidos ativos" value={String(activeOrders)} />
                <Metric icon={WalletCards} label="Faturamento hoje" value={formatCurrency(revenue)} />
                <Metric icon={Users} label="Chamados" value={String(waiterCalls)} />
                <Metric icon={ReceiptText} label="Contas solicitadas" value={String(billRequests)} />
              </div>
              <TablesAndQr />
            </>
          )}

          {activeView === "cardapio" && <MenuManager />}
          {activeView === "mesas" && <TablesAndQr />}
          {activeView === "equipe" && <SettingsManager />}
          {activeView === "musica" && <MusicRequestsManager />}
          {activeView === "financeiro" && <FinanceManager />}
          {activeView === "categorias" && <CategoriesManager />}
          {activeView === "pedidos" && <OrdersHistoryManager />}
          {activeView === "configuracoes" && <SettingsManager />}
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-semibold">Gerenciamento de Mesas ({displayTables.length})</h2>
            <p className="text-xs text-zinc-500">Gerencie atribuições de garçons e imprima as placas das mesas.</p>
          </div>
          <Button variant="outline" size="sm" onClick={printAllQrCodes} className="gap-1.5 border-white/20 text-xs font-semibold hover:bg-white/10">
            <Printer className="h-4 w-4 text-red-400" />
            Imprimir TODOS os QR Codes ({displayTables.length} Mesas)
          </Button>
        </div>
        <div className="space-y-2">
          {displayTables.map((table) => (
            <div key={table.id} className="grid gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-3 text-sm md:grid-cols-[1fr_180px_auto_auto] md:items-center">
              <button className="text-left" onClick={() => setSelectedTable(table.qrToken)}>
                <span className="font-semibold">Mesa {table.number.toString().padStart(2, "0")}</span>
                <p className="text-xs text-zinc-500">
                  {table.guests.length ? `${table.guests.join(", ")} · ${formatCurrency(table.total / 100)}` : "Sem sessao ativa"}
                </p>
                <p className="text-xs text-zinc-600">{table.waiter ? `Garcom: ${table.waiter.name}` : "Sem garcom atribuido"}</p>
              </button>
              <select
                value={table.waiter?.id ?? ""}
                onChange={(event) => assignWaiter(table.qrToken, event.target.value)}
                className="h-9 rounded-md border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-red-500"
              >
                <option value="">Sem garcom</option>
                {waiters.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>
                    {waiter.name}
                  </option>
                ))}
              </select>
              <span className={cn("text-xs", table.sessionId ? "text-amber-300" : "text-emerald-300")}>
                {table.sessionId ? "Aberta" : "Disponivel"}
              </span>
              <Button size="sm" variant="secondary" disabled={!table.sessionId} onClick={() => closeTable(table.qrToken)}>
                Fechar conta
              </Button>
            </div>
          ))}
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

function FinanceManager() {
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "",
    category: "",
    amount: "",
    occurredAt: new Date().toISOString().slice(0, 10)
  });

  const range = useMemo(() => {
    const [year, month, day] = anchorDate.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);

    const start =
      period === "month"
        ? new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end =
      period === "month"
        ? new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

    return {
      from: start.toISOString(),
      to: end.toISOString()
    };
  }, [anchorDate, period]);

  const loadFinance = useCallback(async () => {
    const params = new URLSearchParams(range);
    const [summaryResponse, expensesResponse] = await Promise.all([
      fetch(`/api/finance/summary?${params.toString()}`, { cache: "no-store" }),
      fetch(`/api/expenses?${params.toString()}`, { cache: "no-store" })
    ]);

    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as FinanceSummary;
      setSummary(data);
    }

    if (expensesResponse.ok) {
      const data = (await expensesResponse.json()) as { expenses?: Expense[] };
      setExpenses(data.expenses ?? []);
    }

    setLoading(false);
  }, [range]);

  useEffect(() => {
    window.setTimeout(() => {
      setLoading(true);
      loadFinance();
    }, 0);
  }, [loadFinance]);

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(true);
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description.trim(),
        category: form.category.trim() || null,
        amountCents: Math.round(amount * 100),
        occurredAt: `${form.occurredAt}T12:00:00.000Z`
      })
    });

    setSaving(false);
    if (!response.ok) return;

    setForm((current) => ({
      ...current,
      description: "",
      amount: ""
    }));
    await loadFinance();
  }

  return (
    <div className="space-y-5">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Button variant={period === "day" ? "default" : "secondary"} onClick={() => setPeriod("day")}>
              Dia
            </Button>
            <Button variant={period === "month" ? "default" : "secondary"} onClick={() => setPeriod("month")}>
              Mes
            </Button>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Data de referencia</p>
            <Input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={WalletCards} label="Faturamento" value={formatCurrency((summary?.revenueCents ?? 0) / 100)} />
        <Metric icon={ReceiptText} label="Gastos" value={formatCurrency((summary?.expensesCents ?? 0) / 100)} />
        <Metric icon={BarChart3} label="Liquido" value={formatCurrency((summary?.netCents ?? 0) / 100)} />
        <Metric icon={ShoppingBag} label="Pedidos entregues" value={String(summary?.deliveredOrders ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <Card className="border-white/10 bg-black/45 p-4">
          <h2 className="text-lg font-semibold">Lancar gasto</h2>
          <p className="mt-1 text-sm text-zinc-500">Registre despesas operacionais para acompanhar o lucro real.</p>
          <form className="mt-4 space-y-3" onSubmit={submitExpense}>
            <Field label="Descricao">
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Ex.: compra de insumos"
              />
            </Field>
            <Field label="Categoria">
              <Input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Ex.: estoque, energia, marketing"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)">
                <Input
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="120,50"
                />
              </Field>
              <Field label="Data">
                <Input
                  type="date"
                  value={form.occurredAt}
                  onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                />
              </Field>
            </div>
            <Button className="w-full" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar gasto"}
            </Button>
          </form>
        </Card>

        <Card className="border-white/10 bg-black/45 p-4">
          <h2 className="text-lg font-semibold">Gastos do periodo</h2>
          <p className="mt-1 text-sm text-zinc-500">{period === "day" ? "Visao diaria" : "Visao mensal"} do caixa.</p>

          {loading && <p className="mt-4 text-sm text-zinc-500">Carregando dados financeiros...</p>}

          {!loading && expenses.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">Nenhum gasto registrado neste periodo.</p>
          )}

          <div className="mt-4 space-y-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{expense.description}</p>
                    <p className="text-xs text-zinc-500">
                      {expense.category || "Sem categoria"} · {new Date(expense.occurredAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-red-300">-{formatCurrency(expense.amountCents / 100)}</p>
                </div>
              </div>
            ))}
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
    imageUrl: ""
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
    setForm({ name: "", description: "", category: form.category, price: "", imageUrl: "" });
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
      imageUrl: product.imageUrl ?? ""
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

type OrderHistoryItem = {
  id: string;
  table: string;
  tableNumber: number;
  customerName: string;
  status: string;
  statusLabel: string;
  items: string[];
  total: number;
  createdAt: string;
};

function OrdersHistoryManager() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableFilter, setTableFilter] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (tableFilter) params.set("table", tableFilter);
    if (search.trim()) params.set("q", search.trim());

    const response = await fetch(`/api/orders/history?${params.toString()}`, { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { orders?: OrderHistoryItem[] };
      setOrders(data.orders ?? []);
    }
    setLoading(false);
  }, [search, statusFilter, tableFilter]);

  useEffect(() => {
    window.setTimeout(loadHistory, 0);
  }, [loadHistory]);

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-zinc-400">Buscar</p>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950 px-3 py-1">
              <Search className="h-4 w-4 text-zinc-500" />
              <Input
                className="border-0 bg-transparent px-0 text-xs focus:ring-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, ID ou item..."
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-400">Filtrar por Status</p>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none"
            >
              <option value="ALL">Todos os status</option>
              <option value="PENDING">Pendente</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PREPARING">Em preparo</option>
              <option value="READY">Pronto</option>
              <option value="DELIVERED">Entregue</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-400">Número da Mesa</p>
            <Input
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Ex.: 12"
            />
          </div>
        </div>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-4">Registro de Pedidos ({orders.length})</h2>

        {loading && <p className="text-sm text-zinc-500">Buscando histórico de pedidos...</p>}

        {!loading && orders.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum pedido encontrado para os filtros selecionados.</p>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <div>
                  <span className="font-semibold text-red-300">{o.table}</span>
                  <p className="text-xs text-zinc-400">{o.customerName}</p>
                </div>
                <Badge className="text-xs">{o.statusLabel}</Badge>
              </div>
              <div className="space-y-1 text-xs text-zinc-300 mb-3">
                {o.items.map((item, i) => (
                  <p key={`${o.id}-${i}`}>{item}</p>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-white/10 pt-2">
                <span>{new Date(o.createdAt).toLocaleString("pt-BR")}</span>
                <span className="font-semibold text-white">{formatCurrency(o.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function SettingsManager() {
  const [settings, setSettings] = useState({
    name: "LENDAS 2018",
    logoUrl: "/lendas-logo.png",
    accent: "#d71920",
    businessHours: "18:00 - 02:00",
    phone: "(86) 99999-9999"
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "WAITER", password: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [userFeedback, setUserFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [settingsRes, usersRes] = await Promise.all([
      fetch("/api/restaurant/settings", { cache: "no-store" }),
      fetch("/api/users", { cache: "no-store" })
    ]);

    if (settingsRes.ok) {
      const data = await settingsRes.json();
      if (data.settings) setSettings(data.settings);
    }

    if (usersRes.ok) {
      const data = await usersRes.json();
      if (data.users) setUsers(data.users);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(loadData, 0);
  }, [loadData]);

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    await fetch("/api/restaurant/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setSavingSettings(false);
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) return;
    setAddingUser(true);
    setUserFeedback(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser)
    });

    setAddingUser(false);
    if (res.ok) {
      setNewUser({ name: "", email: "", role: "WAITER", password: "" });
      setUserFeedback("Membro cadastrado com sucesso!");
      await loadData();
    } else {
      setUserFeedback("Erro ao cadastrar membro.");
    }
  }

  async function handleDeleteUser(id: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await loadData();
  }

  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  function handleCopyUserLink(user: { id: string; name: string; role: string }) {
    if (typeof window === "undefined") return;
    let waiterParam = user.id;
    if (user.name.toLowerCase().includes("joao")) waiterParam = "waiter_joao";
    else if (user.name.toLowerCase().includes("maria")) waiterParam = "waiter_maria";
    else if (user.name.toLowerCase().includes("pedro")) waiterParam = "waiter_pedro";

    const directUrl = `${window.location.origin}/waiter?waiterId=${waiterParam}`;
    navigator.clipboard.writeText(directUrl).then(() => {
      setCopiedUserId(user.id);
      setTimeout(() => setCopiedUserId(null), 2000);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="border-white/10 bg-black/45 p-4">
        <h2 className="text-lg font-semibold mb-1">Dados do Restaurante</h2>
        <p className="text-xs text-zinc-500 mb-4">Personalize o nome, tema e comunicacao visual.</p>
        <form onSubmit={handleSaveSettings} className="space-y-3">
          <Field label="Nome do Estabelecimento">
            <Input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
          </Field>
          <Field label="URL da Logo">
            <Input value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor de Destaque">
              <Input value={settings.accent} onChange={(e) => setSettings({ ...settings, accent: e.target.value })} placeholder="#d71920" />
            </Field>
            <Field label="Horario de Funcionamento">
              <Input value={settings.businessHours} onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })} placeholder="18:00 - 02:00" />
            </Field>
          </div>
          <Button className="w-full" type="submit" disabled={savingSettings}>
            {savingSettings ? "Salvando..." : "Salvar Dados"}
          </Button>
        </form>
      </Card>

      <Card className="border-white/10 bg-black/45 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Equipe & Links de Acesso</h2>
          <p className="text-xs text-zinc-500">Cadastre membros da equipe e copie os links diretos para cada garçom abrir no celular.</p>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Novo Membro</p>
          <div className="grid grid-cols-2 gap-2">
            <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome" />
            <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email de login" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="h-9 rounded-md border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none"
            >
              <option value="WAITER">Garçom</option>
              <option value="KITCHEN">Cozinha</option>
              <option value="MANAGER">Gerente</option>
              <option value="OWNER">Dono</option>
            </select>
            <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Senha inicial" />
          </div>
          <Button size="sm" className="w-full" type="submit" disabled={addingUser}>
            {addingUser ? "Cadastrando..." : "Adicionar à Equipe"}
          </Button>
          {userFeedback && <p className="text-xs text-emerald-300 text-center">{userFeedback}</p>}
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400">Membros e Links dos Garçons Cadastrados:</p>
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.025] px-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-white">{u.name}</span>
                <p className="text-zinc-500 text-[11px]">{u.email} · <Badge className="text-[10px] py-0 border border-white/20 text-zinc-300 bg-transparent">{u.role}</Badge></p>
              </div>
              <div className="flex items-center gap-1.5">
                {u.role === "WAITER" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px] gap-1 px-2"
                    onClick={() => handleCopyUserLink(u)}
                  >
                    {copiedUserId === u.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedUserId === u.id ? "Link Copiado!" : "Copiar Link do Garçom"}
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-red-300" onClick={() => handleDeleteUser(u.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
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

function Metric({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.045] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-300">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

