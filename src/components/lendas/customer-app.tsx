"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, CreditCard, Home, Minus, Plus, ReceiptText, Search, ShoppingBag, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { categories, menuItems } from "@/components/lendas/data";
import { formatCurrency, cn } from "@/lib/utils";
import { useLendasStore } from "@/store/lendas-store";
import { toThemeStyle } from "@/lib/restaurant-theme";

type Product = (typeof menuItems)[number];
type Step = "welcome" | "menu" | "cart" | "tracking" | "actions";
type CustomerOrder = {
  id: string;
  table: string;
  guest: string;
  items: string[];
  total: number;
  status: "Pendente" | "Confirmado" | "Em preparo" | "Pronto" | "Entregue";
  minutes: number;
};

export function CustomerApp({ tableId, initialName }: { tableId: string; initialName: string }) {
  const [step, setStep] = useState<Step>(initialName ? "menu" : "welcome");
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(categories[0]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const {
    cart,
    restaurant,
    tableSession,
    joinTable,
    addToCart,
    submitOrder,
    callWaiter,
    requestBill
  } = useLendasStore();
  const customerName = name.trim() || "Voce";
  const customerCart = cart.filter((line) => line.customerName === customerName);
  const cartCount = customerCart.reduce((total, line) => total + line.quantity, 0);
  const tableBillTotal = cart.reduce((total, line) => total + line.quantity * line.unitPrice, 0);

  const filteredProducts = useMemo(
    () => {
      const categoryProducts = menuItems.filter((item) => item.category === category);
      return categoryProducts.length ? categoryProducts : menuItems;
    },
    [category]
  );

  function addSelectedProduct() {
    if (!selectedProduct) return;

    addToCart({
      productName: selectedProduct.name,
      customerName,
      quantity,
      unitPrice: selectedProduct.price
    });
    setSelectedProduct(null);
    setQuantity(1);
  }

  function sendOrder() {
    const items = customerCart.map((line) => ({
      productName: line.productName,
      quantity: line.quantity,
      unitCents: Math.round(line.unitPrice * 100)
    }));

    if (items.length) {
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: tableId,
          customerName,
          items
        })
      }).catch(() => {
        // The local optimistic state still keeps the customer flow moving.
      });
    }

    submitOrder({ customerName, tableLabel: `Mesa ${tableId}` });
    setStep("tracking");
  }

  function enterTable() {
    document.cookie = `lendas_mesa_${tableId}_name=${encodeURIComponent(name.trim())}; path=/mesa/${tableId}; max-age=2592000; samesite=lax`;
    joinTable(name, tableId);
    setStep("menu");
  }

  return (
    <main className="min-h-screen bg-background text-foreground" style={toThemeStyle({ ...restaurant, background: "#050505" })}>
      <div className="mx-auto min-h-screen max-w-[430px] bg-[#07080a] shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <div className="relative flex min-h-screen flex-col overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_50%_0%,rgba(215,25,32,0.28),transparent_70%)]" />
          <div className="relative flex-1 px-4 pb-28 pt-5">
            {step === "welcome" && <WelcomeScreen name={name} setName={setName} onEnter={enterTable} tableId={tableId} restaurantName={restaurant.name} />}
            {step === "menu" && (
              <MenuScreen
                tableId={tableId}
                customerName={customerName}
                connectedUsers={tableSession.activeUsers.length}
                category={category}
                setCategory={setCategory}
                products={filteredProducts}
                onSelectProduct={setSelectedProduct}
                onCart={() => setStep("cart")}
                cartCount={cartCount}
              />
            )}
            {step === "cart" && <SharedCart customerName={customerName} cart={cart} tableBillTotal={tableBillTotal} onSend={sendOrder} />}
            {step === "tracking" && <TrackingScreen tableId={tableId} customerName={customerName} />}
            {step === "actions" && <WaiterActions onWaiter={() => callWaiter(customerName)} onBill={() => requestBill(customerName)} />}
          </div>

          {step !== "welcome" && (
            <CustomerNav active={step} setStep={setStep} cartCount={cartCount} />
          )}

          {selectedProduct && (
            <ProductModal
              product={selectedProduct}
              quantity={quantity}
              setQuantity={setQuantity}
              onClose={() => setSelectedProduct(null)}
              onAdd={addSelectedProduct}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function WelcomeScreen({
  name,
  setName,
  onEnter,
  tableId,
  restaurantName
}: {
  name: string;
  setName: (value: string) => void;
  onEnter: () => void;
  tableId: string;
  restaurantName: string;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-[calc(100vh-2.5rem)] flex-col justify-center">
      <div className="mx-auto mb-8 h-36 w-36 overflow-hidden rounded-full border border-red-500/50 bg-black shadow-[0_0_44px_rgba(215,25,32,0.32)]">
        <Image src="/lendas-logo.png" alt="LENDAS 2018" width={144} height={144} className="h-full w-full object-cover" priority />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-400">Bem-vindo ao</p>
        <h1 className="mt-2 text-5xl font-black tracking-wide text-white">{restaurantName.split(" ")[0]}</h1>
        <p className="mt-1 text-xl font-semibold text-red-500">2018</p>
        <p className="mt-6 text-sm text-zinc-400">Mesa {tableId}</p>
      </div>
      <div className="mt-8 space-y-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Qual seu nome?" />
        <Button className="w-full" disabled={!name.trim()} onClick={onEnter}>
          Entrar na mesa
        </Button>
      </div>
    </motion.section>
  );
}

function MenuScreen({
  tableId,
  customerName,
  connectedUsers,
  category,
  setCategory,
  products,
  onSelectProduct,
  onCart,
  cartCount
}: {
  tableId: string;
  customerName: string;
  connectedUsers: number;
  category: string;
  setCategory: (category: string) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onCart: () => void;
  cartCount: number;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">Mesa {tableId} · {connectedUsers} conectados</p>
          <h1 className="text-2xl font-semibold">Ola, {customerName}</h1>
        </div>
        <div className="relative h-11 w-11 overflow-hidden rounded-full border border-red-500/40">
          <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3">
        <Search className="h-4 w-4 text-zinc-500" />
        <Input className="border-0 bg-transparent px-0 focus:ring-0" placeholder="Buscar no cardapio..." />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={cn(
              "shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-300",
              category === item && "border-red-500/60 bg-red-600 text-white"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {products.map((item) => (
          <button key={item.name} onClick={() => onSelectProduct(item)} className="w-full text-left">
            <Card className="flex items-center gap-3 border-white/10 bg-white/[0.045] p-3">
              <div className={cn("grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-gradient-to-br", item.tone)}>
                <Utensils className="h-8 w-8 text-red-100" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{item.name}</h2>
                <p className="line-clamp-2 text-xs text-zinc-400">{item.desc}</p>
                <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(item.price)}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white">
                <Plus className="h-4 w-4" />
              </span>
            </Card>
          </button>
        ))}
      </div>

      {cartCount > 0 && (
        <Button className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-[398px] justify-between" onClick={onCart}>
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Ver carrinho
          </span>
          <span>{cartCount} itens</span>
        </Button>
      )}
    </motion.section>
  );
}

function ProductModal({
  product,
  quantity,
  setQuantity,
  onClose,
  onAdd
}: {
  product: Product;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/70 px-3 pb-3 backdrop-blur-sm">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/10 bg-[#101114] shadow-2xl">
        <div className={cn("grid h-56 place-items-center bg-gradient-to-br", product.tone)}>
          <Utensils className="h-20 w-20 text-red-100" />
        </div>
        <div className="p-5">
          <h2 className="text-2xl font-semibold">{product.name}</h2>
          <p className="mt-2 text-sm text-zinc-400">{product.desc}</p>
          <p className="mt-4 text-lg font-semibold text-red-400">{formatCurrency(product.price)}</p>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-semibold">Quantidade</span>
            <div className="flex items-center gap-4 rounded-lg bg-white/[0.05] p-1">
              <Button variant="secondary" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-mono">{quantity}</span>
              <Button variant="secondary" size="icon" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[0.35fr_1fr] gap-3">
            <Button variant="secondary" onClick={onClose}>Voltar</Button>
            <Button onClick={onAdd}>Adicionar ao carrinho</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SharedCart({
  customerName,
  cart,
  tableBillTotal,
  onSend
}: {
  customerName: string;
  cart: Array<{ id: string; productName: string; customerName: string; quantity: number; unitPrice: number }>;
  tableBillTotal: number;
  onSend: () => void;
}) {
  const grouped = cart.reduce<Record<string, typeof cart>>((groups, line) => {
    groups[line.customerName] = [...(groups[line.customerName] || []), line];
    return groups;
  }, {});
  const customerHasItems = cart.some((line) => line.customerName === customerName);

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Meu pedido</h1>
      <p className="mb-5 text-sm text-zinc-500">Mesa compartilhada · todos acompanham juntos</p>
      <div className="space-y-3">
        {Object.entries(grouped).map(([guest, lines]) => (
          <Card key={guest} className="border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{guest}</p>
              {guest === customerName && <Badge className="border-red-500/30 bg-red-500/10 text-red-100">voce</Badge>}
            </div>
            <div className="space-y-2">
              {lines.map((line) => (
                <Line key={line.id} label={`${line.quantity}x ${line.productName}`} value={line.quantity * line.unitPrice} />
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-black/45 p-4">
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>Total da mesa</span>
          <span className="text-xl font-semibold text-red-400">{formatCurrency(tableBillTotal)}</span>
        </div>
        <Button className="mt-4 w-full" disabled={!customerHasItems} onClick={onSend}>Enviar meu pedido</Button>
      </div>
    </motion.section>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-300">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function TrackingScreen({ tableId, customerName }: { tableId: string; customerName: string }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);

  const loadOrder = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as { orders?: CustomerOrder[] };
    const latestOrder =
      data.orders?.find((item) => item.table === `Mesa ${tableId}` && item.guest === customerName) ?? null;
    setOrder(latestOrder);
  }, [customerName, tableId]);

  useEffect(() => {
    window.setTimeout(loadOrder, 0);
    const interval = window.setInterval(loadOrder, 2500);
    return () => window.clearInterval(interval);
  }, [loadOrder]);

  const currentStatus = order?.status ?? "Pendente";
  const statusRank = {
    Pendente: 0,
    Confirmado: 1,
    "Em preparo": 2,
    Pronto: 3,
    Entregue: 4
  } satisfies Record<CustomerOrder["status"], number>;

  const steps = [
    ["Aguardando confirmacao", "Recebemos seu pedido", statusRank[currentStatus] >= 0],
    ["Confirmado", "A cozinha aceitou seu pedido", statusRank[currentStatus] >= 1],
    ["Em preparo", "Seu pedido esta sendo preparado", statusRank[currentStatus] >= 2],
    ["Pedido pronto", "Retirada/entrega em instantes", statusRank[currentStatus] >= 3],
    ["Finalizado", "Obrigado. Volte sempre!", statusRank[currentStatus] >= 4]
  ] as const;

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Status do pedido</h1>
      <p className="mb-5 text-sm text-zinc-500">
        {order ? `Pedido ${order.id.slice(-6).toUpperCase()} · Mesa ${tableId}` : `Mesa ${tableId} · aguardando pedido`}
      </p>
      <div className="space-y-3">
        {steps.map(([title, copy, active]) => (
          <Card key={title} className="flex gap-3 border-white/10 bg-white/[0.045] p-4">
            <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border", active ? "border-red-400/60 bg-red-500/20 text-red-200" : "border-white/10 bg-white/[0.04] text-zinc-500")}>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className={cn("font-semibold", active ? "text-red-50" : "text-zinc-300")}>{title}</p>
              <p className="text-sm text-zinc-500">{copy}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 border-white/10 bg-black/45 p-5 text-center">
        <p className="text-sm text-zinc-500">{order ? "Status atual" : "Pedido"}</p>
        <p className="mt-1 text-3xl font-semibold text-red-400">{order ? currentStatus : "Ainda nao enviado"}</p>
      </Card>
    </motion.section>
  );
}

function WaiterActions({ onWaiter, onBill }: { onWaiter: () => void; onBill: () => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Precisando de algo?</h1>
      <p className="mb-5 text-sm text-zinc-500">Sua solicitacao sera enviada para a equipe.</p>
      <div className="space-y-4">
        <button onClick={onWaiter} className="red-sheen flex w-full items-center gap-4 rounded-lg border border-red-500/20 p-5 text-left">
          <Bell className="h-9 w-9 text-red-300" />
          <div>
            <p className="font-semibold">Chamar garcom</p>
            <p className="text-sm text-zinc-400">Precisamos de atendimento na mesa.</p>
          </div>
        </button>
        <button onClick={onBill} className="red-sheen flex w-full items-center gap-4 rounded-lg border border-red-500/20 p-5 text-left">
          <ReceiptText className="h-9 w-9 text-red-300" />
          <div>
            <p className="font-semibold">Pedir conta</p>
            <p className="text-sm text-zinc-400">Gostariamos de solicitar a conta.</p>
          </div>
        </button>
      </div>
    </motion.section>
  );
}

function CustomerNav({ active, setStep, cartCount }: { active: Step; setStep: (step: Step) => void; cartCount: number }) {
  const items = [
    ["menu", Home, "Cardapio"],
    ["cart", ShoppingBag, "Carrinho"],
    ["tracking", CheckCircle2, "Pedido"],
    ["actions", CreditCard, "Conta"]
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[430px] grid-cols-4 border-t border-white/10 bg-black/85 px-3 py-3 backdrop-blur">
      {items.map(([step, Icon, label]) => (
        <button key={step} onClick={() => setStep(step)} className={cn("relative flex flex-col items-center gap-1 text-[11px] text-zinc-500", active === step && "text-red-500")}>
          <Icon className="h-4 w-4" />
          {label}
          {step === "cart" && cartCount > 0 && <span className="absolute -top-1 right-6 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">{cartCount}</span>}
        </button>
      ))}
    </nav>
  );
}
