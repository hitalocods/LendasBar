"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { BarChart3, Boxes, Camera, Grid2X2, Music2, Pencil, ReceiptText, Search, Settings, ShoppingBag, Trash2, Users, WalletCards } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { useLendasStore } from "@/store/lendas-store";

type AdminView = "dashboard" | "cardapio" | "categorias" | "mesas" | "pedidos" | "musica" | "configuracoes";
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

export function AdminPanel() {
  const { orders, waiterCalls, billRequests } = useLendasStore();
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const activeOrders = orders.filter((order) => order.status !== "Entregue").length;
  const revenue = orders.reduce((total, order) => total + order.total, 0);

  return (
    <main className="noise min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-white/10 bg-black/55 p-4">
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
              [ReceiptText, "Pedidos", "pedidos"],
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
        </aside>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Painel administrativo</p>
              <h1 className="text-2xl font-semibold">
                {activeView === "cardapio" ? "Cardapio e produtos" : "Gestao do restaurante"}
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
          {activeView === "musica" && <MusicRequestsManager />}
          {activeView === "categorias" && <Placeholder title="Categorias" copy="As categorias sao criadas automaticamente ao cadastrar produtos." />}
          {activeView === "pedidos" && <Placeholder title="Pedidos" copy="O historico completo sera ligado aos filtros por data e mesa." />}
          {activeView === "configuracoes" && <Placeholder title="Configuracoes" copy="Aqui ficarao tema, logo, horarios e dados do restaurante." />}
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
    : Array.from({ length: 20 }, (_, index) => ({
        id: String(index + 1),
        number: index + 1,
        qrToken: String(index + 1),
        status: "AVAILABLE",
        sessionId: null,
        waiter: null,
        guests: [],
        total: 0
      }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mesas</h2>
          <Button variant="secondary" size="sm">Ver todas</Button>
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

function MenuManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Coxinhas",
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
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Coxinha com Catupiry" />
          </Field>
          <Field label="Descricao">
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Massa crocante e recheio cremoso" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Coxinhas" />
            </Field>
            <Field label="Preco">
              <Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="8,90" />
            </Field>
          </div>
          <Field label="Foto">
            <Input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." />
          </Field>
          <Button className="w-full" type="submit">{editingId ? "Salvar alteracoes" : "Cadastrar produto"}</Button>
          {editingId && (
            <Button className="w-full" type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancelar edicao
            </Button>
          )}
        </form>
        <p className="mt-3 text-xs text-zinc-500">Use uma URL de imagem por enquanto. O upload direto entra na etapa de integração Cloudinary/UploadThing.</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Placeholder({ title, copy }: { title: string; copy: string }) {
  return (
    <Card className="border-white/10 bg-black/45 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500">{copy}</p>
    </Card>
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
