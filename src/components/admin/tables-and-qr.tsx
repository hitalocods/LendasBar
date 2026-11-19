"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import type { TableRow, Waiter } from "./types";

export function TablesAndQr() {
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
    let interval = window.setInterval(loadTables, 5000);

    // Pausa o polling quando a aba está em background para economizar requests
    function handleVisibilityChange() {
      if (document.hidden) {
        window.clearInterval(interval);
      } else {
        // Recarrega imediatamente ao voltar para a aba
        loadTables().catch(() => {});
        interval = window.setInterval(loadTables, 5000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
    // Usa a API pública do Google Charts para gerar QR codes sem depender de
    // serviços de terceiros instáveis. É confiável e não requer autenticação.
    const cardsHtml = displayTables
      .map((table) => {
        const url = `${origin}/mesa/${table.qrToken}`;
        const qrImageUrl = `https://chart.googleapis.com/chart?cht=qr&chs=250x250&choe=UTF-8&chl=${encodeURIComponent(url)}`;
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
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
      <Card className="border-white/10 bg-black/45 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-semibold">Painel de Mesas — ({displayTables.length})</h2>
            <p className="text-xs text-zinc-500">Visão em bloco com identificação do garçom, valor e status do caixa.</p>
          </div>
          <Button variant="outline" size="sm" onClick={printAllQrCodes} className="gap-1.5 border-white/20 text-xs font-semibold hover:bg-white/10">
            <Printer className="h-4 w-4 text-red-400" />
            Imprimir Todos QR Codes
          </Button>
        </div>

        {/* Filtros de Status */}
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

        {/* Grid de Mesas */}
        <div className="grid grid-cols-2 min-[520px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
