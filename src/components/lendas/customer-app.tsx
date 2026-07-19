"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, CreditCard, Home, Minus, Music2, Plus, ReceiptText, Search, ShoppingBag, Trash2, Utensils } from "lucide-react";
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
type Step = "welcome" | "menu" | "cart" | "sent" | "actions" | "music";
type BillGroup = {
  customerName: string;
  lines: Array<{ label: string; value: number }>;
  total: number;
};
type TableBill = {
  groups: BillGroup[];
  total: number;
  status: string;
  users?: Array<{ id: string; name: string; active: boolean }>;
};
type TableSessionUser = {
  id: string;
  name: string;
  clientId?: string;
};

export function CustomerApp({ tableId, initialName }: { tableId: string; initialName: string }) {
  const [step, setStep] = useState<Step>(initialName ? "menu" : "welcome");
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(categories[0]);
  const [products, setProducts] = useState<Product[]>(menuItems);
  const [bill, setBill] = useState<TableBill | null>(null);
  const [sessionUser, setSessionUser] = useState<TableSessionUser | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [orderSendFeedback, setOrderSendFeedback] = useState<string | null>(null);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [musicNotes, setMusicNotes] = useState("");
  const [musicSent, setMusicSent] = useState(false);
  const {
    cart,
    restaurant,
    tableSession,
    joinTable,
    addToCart,
    removeFromCart,
    submitOrder,
    callWaiter,
    requestBill
  } = useLendasStore();
  const customerName = name.trim() || "Voce";
  const customerCart = cart.filter((line) => line.customerName === customerName);
  const cartCount = customerCart.reduce((total, line) => total + line.quantity, 0);
  const pendingCartTotal = cart.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  const liveCategories = useMemo(() => Array.from(new Set(products.map((item) => item.category))), [products]);
  const connectedUsers = bill?.users?.length || tableSession.activeUsers.length || (sessionUser ? 1 : 0);

  const filteredProducts = useMemo(
    () => {
      const categoryProducts = products.filter((item) => item.category === category);
      return categoryProducts.length ? categoryProducts : products;
    },
    [category, products]
  );

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { products?: Product[] } | null) => {
        if (data?.products?.length) {
          setProducts(data.products);
          setCategory(data.products[0].category);
        }
      })
      .catch(() => {});
  }, []);

  const loadBill = useCallback(async () => {
    const response = await fetch(`/api/tables/${tableId}/bill`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as TableBill;
    setBill(data);

    if (data.status === "CLOSED" || !data.groups?.length) {
      if (data.status === "CLOSED") {
        useLendasStore.setState({ cart: [] });
      }
    }
  }, [tableId]);

  const ensureClientId = useCallback(() => {
    const key = `lendas:mesa:${tableId}:clientId`;
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const generated = crypto.randomUUID();
    window.localStorage.setItem(key, generated);
    return generated;
  }, [tableId]);

  const registerSessionUser = useCallback(async (customer: string) => {
    const clientId = ensureClientId();
    const response = await fetch(`/api/mesa/${tableId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: customer, clientId })
    });

    if (!response.ok) return;

    const data = (await response.json()) as {
      user?: TableSessionUser;
      users?: Array<{ id: string; name: string; active: boolean }>;
    };
    if (data.user) setSessionUser(data.user);
    if (data.users) {
      setBill((current) => ({ ...(current ?? { groups: [], total: 0, status: "ACTIVE" }), users: data.users }));
    }
  }, [ensureClientId, tableId]);

  useEffect(() => {
    if (step !== "cart") return;
    window.setTimeout(loadBill, 0);
    const interval = window.setInterval(loadBill, 2500);
    return () => window.clearInterval(interval);
  }, [loadBill, step]);

  useEffect(() => {
    if (initialName) {
      window.setTimeout(() => {
        registerSessionUser(initialName).catch(() => {});
      }, 0);
    }
  }, [initialName, registerSessionUser]);

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

  async function sendOrder() {
    if (isSendingOrder) return;

    const items = customerCart.map((line) => ({
      productName: line.productName,
      quantity: line.quantity,
      unitCents: Math.round(line.unitPrice * 100)
    }));

    if (!items.length) return;

    setIsSendingOrder(true);
    setOrderSendFeedback(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: tableId,
          sessionUserId: sessionUser?.id,
          customerName,
          items
        })
      });

      if (response.ok) {
        submitOrder({ customerName, tableLabel: `Mesa ${tableId}` });
        setStep("sent");
        return;
      }

      if (response.status === 409) {
        setOrderSendFeedback("Pedido ja enviado.");
        submitOrder({ customerName, tableLabel: `Mesa ${tableId}` });
        setStep("sent");
        return;
      }

      setOrderSendFeedback("Nao foi possivel enviar agora. Tente novamente em alguns segundos.");
    } catch {
      setOrderSendFeedback("Falha de conexao. Verifique a internet e tente novamente.");
    } finally {
      setIsSendingOrder(false);
    }
  }

  function enterTable() {
    document.cookie = `lendas_mesa_${tableId}_name=${encodeURIComponent(name.trim())}; path=/mesa/${tableId}; max-age=2592000; samesite=lax`;
    joinTable(name, tableId);
    registerSessionUser(name).catch(() => {});
    setStep("menu");
  }

  function resetCustomer() {
    document.cookie = `lendas_mesa_${tableId}_name=; path=/mesa/${tableId}; max-age=0; samesite=lax`;
    setName("");
    setSessionUser(null);
    useLendasStore.setState({ cart: [] });
    setStep("welcome");
  }

  async function sendWaiterCall(type: "WAITER" | "BILL") {
    await fetch("/api/waiter-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableToken: tableId,
        customerName,
        type
      })
    }).catch(() => {});

    if (type === "WAITER") {
      callWaiter(customerName);
    } else {
      requestBill(customerName);
    }
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
                connectedUsers={connectedUsers}
                category={category}
                categories={liveCategories.length ? liveCategories : categories}
                setCategory={setCategory}
                products={filteredProducts}
                onSelectProduct={setSelectedProduct}
                onCart={() => setStep("cart")}
                onReset={resetCustomer}
                cartCount={cartCount}
              />
            )}
            {step === "cart" && (
              <SharedCart
                customerName={customerName}
                cart={cart}
                bill={bill}
                tableBillTotal={(bill?.total ?? 0) / 100 + pendingCartTotal}
                onRemove={removeFromCart}
                onSend={sendOrder}
                isSending={isSendingOrder}
                sendFeedback={orderSendFeedback}
              />
            )}
            {step === "sent" && <OrderSentScreen onBackToMenu={() => setStep("menu")} />}
            {step === "music" && (
              <MusicScreen
                customerName={customerName}
                tableId={tableId}
                musicTitle={musicTitle}
                setMusicTitle={setMusicTitle}
                musicArtist={musicArtist}
                setMusicArtist={setMusicArtist}
                musicNotes={musicNotes}
                setMusicNotes={setMusicNotes}
                musicSent={musicSent}
                setMusicSent={setMusicSent}
              />
            )}
            {step === "actions" && <WaiterActions onWaiter={() => sendWaiterCall("WAITER")} onBill={() => sendWaiterCall("BILL")} />}
          </div>

          {step !== "welcome" && step !== "sent" && (
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
  categories,
  setCategory,
  products,
  onSelectProduct,
  onCart,
  onReset,
  cartCount
}: {
  tableId: string;
  customerName: string;
  connectedUsers: number;
  category: string;
  categories: string[];
  setCategory: (category: string) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onCart: () => void;
  onReset: () => void;
  cartCount: number;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">Mesa {tableId} · {connectedUsers} conectados</p>
          <h1 className="text-2xl font-semibold">Ola, {customerName}</h1>
          <button onClick={onReset} className="mt-1 text-xs text-red-300">Trocar nome</button>
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
              <div className={cn("relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br", item.tone)}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                ) : (
                  <Utensils className="h-8 w-8 text-red-100" />
                )}
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
        <div className={cn("relative grid h-56 place-items-center overflow-hidden bg-gradient-to-br", product.tone)}>
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <Utensils className="h-20 w-20 text-red-100" />
          )}
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
  bill,
  tableBillTotal,
  onRemove,
  onSend,
  isSending,
  sendFeedback
}: {
  customerName: string;
  cart: Array<{ id: string; productName: string; customerName: string; quantity: number; unitPrice: number }>;
  bill: TableBill | null;
  tableBillTotal: number;
  onRemove: (id: string) => void;
  onSend: () => void | Promise<void>;
  isSending: boolean;
  sendFeedback: string | null;
}) {
  const grouped = cart.reduce<Record<string, typeof cart>>((groups, line) => {
    groups[line.customerName] = [...(groups[line.customerName] || []), line];
    return groups;
  }, {});
  const customerHasItems = cart.some((line) => line.customerName === customerName);
  const realGroups = bill?.groups ?? [];

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Meu pedido</h1>
      <p className="mb-5 text-sm text-zinc-500">Mesa compartilhada · todos acompanham juntos</p>
      <div className="space-y-3">
        {realGroups.map((group) => (
          <Card key={group.customerName} className="border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{group.customerName}</p>
                <p className="text-xs text-zinc-500">Subtotal {formatCurrency(group.total / 100)}</p>
              </div>
              {group.customerName === customerName && <Badge className="border-red-500/30 bg-red-500/10 text-red-100">voce</Badge>}
            </div>
            <div className="space-y-2">
              {group.lines.map((line, index) => (
                <Line key={`${group.customerName}-${line.label}-${index}`} label={line.label} value={line.value / 100} />
              ))}
            </div>
          </Card>
        ))}
        {Object.entries(grouped).map(([guest, lines]) => (
          <Card key={`pending-${guest}`} className="border-white/10 bg-white/[0.045] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{guest}</p>
                <p className="text-xs text-red-200/80">No carrinho</p>
                <p className="text-xs text-zinc-500">
                  Subtotal {formatCurrency(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0))}
                </p>
              </div>
              {guest === customerName && <Badge className="border-red-500/30 bg-red-500/10 text-red-100">voce</Badge>}
            </div>
            <div className="space-y-2">
              {lines.map((line) => (
                <Line
                  key={line.id}
                  label={`${line.quantity}x ${line.productName}`}
                  value={line.quantity * line.unitPrice}
                  onRemove={guest === customerName ? () => onRemove(line.id) : undefined}
                />
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
        <Button className="mt-4 w-full" disabled={!customerHasItems || isSending} onClick={onSend}>
          {isSending ? "Enviando..." : "Enviar meu pedido"}
        </Button>
        {sendFeedback && (
          <p className="mt-3 text-center text-xs text-amber-200">{sendFeedback}</p>
        )}
      </div>
    </motion.section>
  );
}

function Line({ label, value, onRemove }: { label: string; value: number; onRemove?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 flex-1 text-zinc-300">{label}</span>
      <span className="shrink-0">{formatCurrency(value)}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-200" onClick={onRemove} aria-label={`Remover ${label}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function OrderSentScreen({ onBackToMenu }: { onBackToMenu: () => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Pedido enviado</h1>
      <p className="mb-5 text-sm text-zinc-500">Recebemos seu pedido e a equipe vai cuidar dele agora.</p>
      <Card className="border-white/10 bg-white/[0.045] p-5 text-center">
        <p className="text-3xl font-semibold text-red-400">Pedido enviado</p>
        <Button className="mt-5 w-full" onClick={onBackToMenu}>
          Voltar ao cardapio
        </Button>
      </Card>
    </motion.section>
  );
}

function WaiterActions({ onWaiter, onBill }: { onWaiter: () => void; onBill: () => void }) {
  const [sent, setSent] = useState<"WAITER" | "BILL" | null>(null);

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Precisando de algo?</h1>
      <p className="mb-5 text-sm text-zinc-500">Sua solicitacao sera enviada para a equipe.</p>
      <div className="space-y-4">
        <button
          onClick={() => {
            setSent("WAITER");
            onWaiter();
          }}
          className="red-sheen flex w-full items-center gap-4 rounded-lg border border-red-500/20 p-5 text-left"
        >
          <Bell className="h-9 w-9 text-red-300" />
          <div>
            <p className="font-semibold">Chamar garcom</p>
            <p className="text-sm text-zinc-400">Precisamos de atendimento na mesa.</p>
          </div>
        </button>
        <button
          onClick={() => {
            setSent("BILL");
            onBill();
          }}
          className="red-sheen flex w-full items-center gap-4 rounded-lg border border-red-500/20 p-5 text-left"
        >
          <ReceiptText className="h-9 w-9 text-red-300" />
          <div>
            <p className="font-semibold">Pedir conta</p>
            <p className="text-sm text-zinc-400">Gostariamos de solicitar a conta.</p>
          </div>
        </button>
        {sent && (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {sent === "WAITER" ? "Chamado enviado para o garcom." : "Pedido de conta enviado para a equipe."}
          </Card>
        )}
      </div>
    </motion.section>
  );
}

function MusicScreen({
  customerName,
  tableId,
  musicTitle,
  setMusicTitle,
  musicArtist,
  setMusicArtist,
  musicNotes,
  setMusicNotes,
  musicSent,
  setMusicSent
}: {
  customerName: string;
  tableId: string;
  musicTitle: string;
  setMusicTitle: (value: string) => void;
  musicArtist: string;
  setMusicArtist: (value: string) => void;
  musicNotes: string;
  setMusicNotes: (value: string) => void;
  musicSent: boolean;
  setMusicSent: (value: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function sendMusicRequest() {
    const title = musicTitle.trim();
    if (!title) return;

    setLoading(true);
    try {
      const response = await fetch("/api/music-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: tableId,
          customerName,
          title,
          artist: musicArtist,
          notes: musicNotes
        })
      });

      if (!response.ok) return;

      setMusicTitle("");
      setMusicArtist("");
      setMusicNotes("");
      setMusicSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="mb-1 text-2xl font-semibold">Pedido de musica</h1>
      <p className="mb-5 text-sm text-zinc-500">Mande sua sugestao para a equipe avaliar e tocar quando puder.</p>
      <div className="space-y-3">
        <Card className="border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-red-300">Mesa {tableId}</p>
          <div className="mt-4 space-y-3">
            <Input value={musicTitle} onChange={(event) => setMusicTitle(event.target.value)} placeholder="Nome da musica" />
            <Input value={musicArtist} onChange={(event) => setMusicArtist(event.target.value)} placeholder="Artista ou banda" />
            <Input value={musicNotes} onChange={(event) => setMusicNotes(event.target.value)} placeholder="Recado opcional para o dono" />
            <Button className="w-full" onClick={sendMusicRequest} disabled={loading || !musicTitle.trim()}>
              {loading ? "Enviando..." : "Pedir musica"}
            </Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-black/45 p-4">
          <div className="flex items-center gap-3">
            <Music2 className="h-5 w-5 text-red-300" />
            <div>
              <p className="font-semibold">Como funciona</p>
              <p className="text-sm text-zinc-500">O pedido vai para o painel interno e a equipe marca quando tocar.</p>
            </div>
          </div>
        </Card>

        {musicSent && (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Pedido enviado para a equipe.
          </Card>
        )}
      </div>
    </motion.section>
  );
}

function CustomerNav({ active, setStep, cartCount }: { active: Step; setStep: (step: Step) => void; cartCount: number }) {
  const items = [
    ["menu", Home, "Cardapio"],
    ["cart", ShoppingBag, "Carrinho"],
    ["music", Music2, "Musica"],
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



