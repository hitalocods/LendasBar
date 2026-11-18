"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, Minus, Music2, Plus, Search, ShoppingBag, Trash2, Utensils } from "lucide-react";
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
type Step = "welcome" | "menu" | "cart" | "sent" | "waiter" | "music";
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
  isHost?: boolean;
};

export function CustomerApp({ tableId, initialName }: { tableId: string; initialName: string }) {
  const [step, setStep] = useState<Step>(initialName ? "menu" : "welcome");
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(categories[0]);
  const [products, setProducts] = useState<Product[]>(menuItems);
  const [bill, setBill] = useState<TableBill | null>(null);
  const [sessionUser, setSessionUser] = useState<TableSessionUser | null>(null);
  const [hostUser, setHostUser] = useState<{ id: string; name: string } | null>(null);
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
      user?: TableSessionUser & { isHost?: boolean };
      users?: Array<{ id: string; name: string; active: boolean }>;
      isHost?: boolean;
      hostUser?: { id: string; name: string } | null;
    };
    if (data.user) setSessionUser({ ...data.user, isHost: Boolean(data.isHost) });
    if (data.hostUser) setHostUser(data.hostUser);
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

  async function sendWaiterCall(reason?: string) {
    callWaiter(customerName);

    await fetch("/api/waiter-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableToken: tableId,
        customerName: reason ? `${customerName} (${reason})` : customerName,
        type: "WAITER"
      })
    }).catch(() => {});
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


  const isHost = sessionUser?.isHost ?? (hostUser ? sessionUser?.name === hostUser.name : true);

  return (
    <main className="min-h-screen bg-background text-foreground" style={toThemeStyle({ ...restaurant, background: "#050505" })}>
      <div className="mx-auto min-h-screen w-full max-w-7xl bg-[#07080a] shadow-[0_0_80px_rgba(0,0,0,0.7)] xl:border-x xl:border-white/[0.04]">
        <div className="relative flex min-h-screen flex-col overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(215,25,32,0.28),transparent_70%)]" />
          <div className="relative flex-1 px-4 min-[520px]:px-6 md:px-8 lg:px-10 pb-28 pt-4 min-[520px]:pt-6">
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
                isHost={isHost}
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
                isHost={isHost}
                hostName={hostUser?.name}
                onExploreMenu={() => setStep("menu")}
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
            {step === "waiter" && <WaiterScreen tableId={tableId} onWaiter={sendWaiterCall} />}
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
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center py-6">
      <div className="mx-auto mb-8 h-36 w-36 overflow-hidden rounded-full border border-red-500/50 bg-black shadow-[0_0_44px_rgba(215,25,32,0.32)]">
        <Image src="/lendas-logo.png" alt="LENDAS 2018" width={144} height={144} className="h-full w-full object-cover" priority />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-400">Bem-vindo ao</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-wide text-white">{restaurantName.split(" ")[0]}</h1>
        <p className="mt-1 text-xl font-semibold text-red-500">2018</p>
        <p className="mt-6 text-sm text-zinc-400">Mesa {tableId}</p>
      </div>
      <div className="mt-8 space-y-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Qual seu nome?"
          className="h-12 text-base"
        />
        <Button className="h-12 w-full text-base font-bold" disabled={!name.trim()} onClick={onEnter}>
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
  cartCount,
  isHost
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
  isHost?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const popularProducts = useMemo(() => {
    const featured = products.filter((p) => (p as { isFeatured?: boolean }).isFeatured);
    return featured.length > 0 ? featured : products.slice(0, 4);
  }, [products]);

  const promoProduct = useMemo(() => {
    return products.find((p) => (p as { isPromo?: boolean }).isPromo);
  }, [products]);

  const displayedProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    return products.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <header className="mb-4 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Mesa {tableId} · {connectedUsers} {connectedUsers === 1 ? "pessoa" : "pessoas"}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">Olá, {customerName} 👋</h1>
              {isHost && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] px-2 py-0.5 font-bold">
                  👑 Líder
                </Badge>
              )}
            </div>
            <button onClick={onReset} className="mt-0.5 text-xs text-zinc-400 hover:text-red-300 underline">
              Trocar nome
            </button>
          </div>
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-red-500/40 shadow-lg min-[520px]:hidden">
            <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
          </div>
        </div>

        {/* Barra de Busca Inteligente + Logo em Tablets/Desktop */}
        <div className="flex items-center gap-3 min-[520px]:flex-1 min-[520px]:max-w-md min-[520px]:justify-end">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-1.5 shadow-inner">
            <Search className="h-4 w-4 text-red-400 shrink-0" />
            <Input
              className="h-8 border-0 bg-transparent px-0 text-sm focus:ring-0 placeholder:text-zinc-500"
              placeholder="O que deseja pedir hoje? Ex: Cerveja, Porção..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative hidden min-[520px]:block h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-full border border-red-500/40 shadow-lg">
            <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
          </div>
        </div>
      </header>

      {/* Banner de Promoção do Dia / Happy Hour */}
      {!searchQuery && (
        <Card
          onClick={() => promoProduct && onSelectProduct(promoProduct)}
          className="mb-4 overflow-hidden border-red-500/40 bg-gradient-to-r from-red-950/80 via-black to-zinc-950 p-3.5 min-[520px]:p-4 text-white shadow-xl relative cursor-pointer hover:border-red-400 transition"
        >
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <Badge className="mb-1 border-amber-500/50 bg-amber-500/20 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider">
                🏷️ Promoção do Dia
              </Badge>
              <h2 className="text-base min-[520px]:text-lg font-bold text-white">{promoProduct ? promoProduct.name : "Combo Happy Hour Lendas 🍻"}</h2>
              <p className="text-xs min-[520px]:text-sm text-zinc-300 mt-0.5">{promoProduct ? promoProduct.desc : "Pedindo bebidas ou porções, ganhe desconto especial na comanda."}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs min-[520px]:text-sm text-zinc-400 line-through">
                {promoProduct ? formatCurrency(promoProduct.price) : "R$ 35,00"}
              </span>
              <p className="text-xl min-[520px]:text-2xl font-black text-emerald-400">
                {promoProduct && (promoProduct as { promoPrice?: number | null }).promoPrice
                  ? formatCurrency((promoProduct as { promoPrice?: number }).promoPrice!)
                  : "R$ 29,90"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Carrossel / Grid de Mais Pedidos da Casa */}
      {!searchQuery && (
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm min-[520px]:text-base font-bold tracking-wide text-zinc-200 flex items-center gap-1.5">
              <span>🔥</span> Mais Pedidos da Casa
            </h2>
            <span className="text-[11px] min-[520px]:text-xs text-zinc-500 font-medium">Os campeões do bar</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none min-[520px]:grid min-[520px]:grid-cols-2 xl:grid-cols-4 min-[520px]:gap-3 min-[520px]:overflow-visible">
            {popularProducts.map((item) => (
              <div
                key={`pop-${item.name}`}
                onClick={() => onSelectProduct(item)}
                className="group relative flex w-60 min-[520px]:w-auto shrink-0 min-[520px]:shrink items-center gap-3 rounded-xl border border-red-500/30 bg-gradient-to-r from-white/[0.06] to-black p-2.5 transition cursor-pointer select-none shadow-md hover:border-red-400 hover:bg-white/[0.08]"
              >
                <div className="relative h-16 w-16 min-[520px]:h-18 min-[520px]:w-18 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover group-hover:scale-105 transition" />
                  ) : (
                    <Utensils className="m-auto h-7 w-7 text-red-400" />
                  )}
                  <Badge className="absolute left-1 top-1 bg-red-600/95 text-[8px] px-1 py-0 font-extrabold text-white">
                    🔥 Top
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs min-[520px]:text-sm font-bold text-white leading-tight">{item.name}</p>
                  <p className="line-clamp-1 text-[10px] min-[520px]:text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs min-[520px]:text-sm font-extrabold text-emerald-400">{formatCurrency(item.price)}</span>
                    <span className="grid h-6 w-6 min-[520px]:h-7 min-[520px]:w-7 shrink-0 place-items-center rounded-full bg-red-600 text-white text-xs font-bold shadow hover:bg-red-500">
                      +
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorias Filtro */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 min-[520px]:flex-wrap min-[520px]:overflow-visible">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={cn(
              "shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs min-[520px]:text-sm font-bold transition text-zinc-300 hover:bg-white/10",
              category === item && "border-red-500/60 bg-red-600 text-white shadow-md hover:bg-red-600"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Lista Principal de Produtos */}
      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 xl:grid-cols-3 gap-3 min-[520px]:gap-3.5">
        {displayedProducts.length === 0 && (
          <p className="col-span-full py-8 text-center text-xs min-[520px]:text-sm text-zinc-500">Nenhum produto encontrado para a busca.</p>
        )}
        {displayedProducts.map((item) => (
          <button key={item.name} onClick={() => onSelectProduct(item)} className="w-full text-left">
            <Card className="h-full flex items-center gap-3 border-white/10 bg-white/[0.045] p-3 min-[520px]:p-3.5 transition hover:border-red-500/40 hover:bg-white/[0.07]">
              <div className={cn("relative grid h-20 w-20 min-[520px]:h-22 min-[520px]:w-22 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br", item.tone)}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                ) : (
                  <Utensils className="h-8 w-8 text-red-100" />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="line-clamp-2 text-sm min-[520px]:text-base font-semibold text-white leading-snug">{item.name}</h2>
                  <p className="line-clamp-2 text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-sm min-[520px]:text-base font-bold text-emerald-400">{formatCurrency(item.price)}</p>
                  <span className="grid h-8 w-8 min-[520px]:h-9 min-[520px]:w-9 place-items-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-500 shrink-0">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {cartCount > 0 && (
        <Button className="fixed inset-x-4 min-[520px]:inset-x-6 bottom-20 z-20 mx-auto max-w-xl justify-between font-bold shadow-2xl h-12 min-[520px]:h-14 text-sm min-[520px]:text-base px-5" onClick={onCart}>
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 min-[520px]:h-5 min-[520px]:w-5" />
            Ver carrinho da mesa
          </span>
          <span className="rounded bg-black/30 px-2 py-0.5 text-xs font-mono">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
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
    <div className="fixed inset-0 z-40 grid place-items-end min-[520px]:place-items-center bg-black/75 p-0 min-[520px]:p-6 backdrop-blur-sm">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-lg overflow-hidden rounded-t-3xl min-[520px]:rounded-3xl border border-white/10 bg-[#101114] shadow-2xl">
        <div className={cn("relative grid h-52 min-[520px]:h-64 place-items-center overflow-hidden bg-gradient-to-br", product.tone)}>
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <Utensils className="h-20 w-20 min-[520px]:h-24 min-[520px]:w-24 text-red-100" />
          )}
        </div>
        <div className="p-5 min-[520px]:p-6">
          <h2 className="text-2xl min-[520px]:text-3xl font-bold">{product.name}</h2>
          <p className="mt-2 text-sm min-[520px]:text-base text-zinc-400">{product.desc}</p>
          <p className="mt-4 text-xl font-bold text-emerald-400">{formatCurrency(product.price)}</p>
          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm min-[520px]:text-base font-semibold">Quantidade</span>
            <div className="flex items-center gap-4 rounded-xl bg-white/[0.05] p-1.5 border border-white/10">
              <Button variant="secondary" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-mono font-bold text-base">{quantity}</span>
              <Button variant="secondary" size="icon" className="h-9 w-9" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-[0.35fr_1fr] gap-3">
            <Button variant="secondary" className="h-12 text-sm min-[520px]:text-base" onClick={onClose}>Voltar</Button>
            <Button className="h-12 text-sm min-[520px]:text-base font-bold" onClick={onAdd}>Adicionar ao carrinho</Button>
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
  sendFeedback,
  isHost,
  hostName,
  onExploreMenu
}: {
  customerName: string;
  cart: Array<{ id: string; productName: string; customerName: string; quantity: number; unitPrice: number }>;
  bill: TableBill | null;
  tableBillTotal: number;
  onRemove: (id: string) => void;
  onSend: () => void | Promise<void>;
  isSending: boolean;
  sendFeedback: string | null;
  isHost?: boolean;
  hostName?: string;
  onExploreMenu?: () => void;
}) {
  const grouped = cart.reduce<Record<string, typeof cart>>((groups, line) => {
    groups[line.customerName] = [...(groups[line.customerName] || []), line];
    return groups;
  }, {});
  const realGroups = bill?.groups ?? [];
  const hasItems = cart.length > 0 || realGroups.length > 0;

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Fazer Pedido</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Carrinho da Mesa</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">Revise os itens e envie para a cozinha ou bar.</p>
      </div>

      {!hasItems ? (
        <Card className="border-white/10 bg-white/[0.04] p-8 text-center max-w-lg mx-auto">
          <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
          <h2 className="text-base font-bold text-white">Carrinho vazio</h2>
          <p className="mt-1 mb-5 text-xs text-zinc-400">
            Você ainda não adicionou nenhum item do cardápio ao pedido.
          </p>
          {onExploreMenu && (
            <Button onClick={onExploreMenu} className="font-bold">
              Ver cardápio
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 min-[700px]:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-3">
            {realGroups.map((group) => (
              <Card key={group.customerName} className="border-white/10 bg-white/[0.045] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{group.customerName}</p>
                    <p className="text-xs text-zinc-400">Já pedido · {formatCurrency(group.total / 100)}</p>
                  </div>
                  {group.customerName === customerName && <Badge className="border-red-500/30 bg-red-500/10 text-red-100">você</Badge>}
                </div>
                <div className="space-y-2">
                  {group.lines.map((line, index) => (
                    <Line key={`${group.customerName}-${line.label}-${index}`} label={line.label} value={line.value / 100} />
                  ))}
                </div>
              </Card>
            ))}
            {Object.entries(grouped).map(([guest, lines]) => (
              <Card key={`pending-${guest}`} className="border-red-500/30 bg-gradient-to-b from-red-950/20 to-black p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{guest}</p>
                    <p className="text-xs text-amber-300 font-medium">Pronto para enviar</p>
                    <p className="text-xs text-zinc-400">
                      Subtotal {formatCurrency(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0))}
                    </p>
                  </div>
                  {guest === customerName && <Badge className="border-red-500/30 bg-red-500/20 text-red-100">você</Badge>}
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
          <div className="lg:sticky lg:top-6 rounded-xl border border-white/10 bg-black/60 p-5 shadow-xl">
            <div className="flex items-center justify-between text-sm text-zinc-300">
              <span className="font-medium">Total dos pedidos da mesa</span>
              <span className="text-2xl font-bold text-red-400">{formatCurrency(tableBillTotal)}</span>
            </div>

            {isHost ? (
              <Button className="mt-5 w-full h-12 text-sm font-bold shadow-lg" disabled={cart.length === 0 || isSending} onClick={onSend}>
                {isSending ? "Enviando pedido..." : "Enviar pedido da mesa"}
              </Button>
            ) : (
              <Button className="mt-5 w-full h-12 font-medium bg-zinc-800 text-zinc-400 border border-white/10 opacity-90 cursor-not-allowed" disabled>
                👑 Aguardando {hostName || "o Líder"} enviar o pedido
              </Button>
            )}
            {sendFeedback && (
              <p className="mt-3 text-center text-xs text-amber-200">{sendFeedback}</p>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function Line({ label, value, onRemove }: { label: string; value: number; onRemove?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 flex-1 text-zinc-300">{label}</span>
      <span className="shrink-0 font-medium">{formatCurrency(value)}</span>
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
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto py-4">
      <h1 className="mb-1 text-2xl sm:text-3xl font-semibold">Pedido enviado!</h1>
      <p className="mb-5 text-sm text-zinc-500">Recebemos seu pedido e a equipe do bar já começou a preparar.</p>
      <Card className="border-red-500/20 bg-white/[0.045] p-6 sm:p-8 text-center">
        <p className="text-2xl sm:text-3xl font-bold text-red-400">Pedido enviado com sucesso</p>
        <p className="mt-2 text-xs sm:text-sm text-zinc-400">Acompanhe seus pedidos ou adicione mais itens pelo cardápio.</p>
        <Button className="mt-6 w-full font-bold h-12" onClick={onBackToMenu}>
          Voltar ao cardápio
        </Button>
      </Card>
    </motion.section>
  );
}

function WaiterScreen({
  tableId,
  onWaiter
}: {
  tableId: string;
  onWaiter: (reason?: string) => Promise<void> | void;
}) {
  const [sent, setSent] = useState(false);
  const [calling, setCalling] = useState(false);
  const [selectedReason, setSelectedReason] = useState("Atendimento na mesa");

  const quickReasons = [
    "Atendimento na mesa",
    "Gelo ou copos",
    "Pratos ou talheres",
    "Guardanapos",
    "Dúvida do cardápio"
  ];

  async function handleCall(reason?: string) {
    const finalReason = reason || selectedReason;
    setCalling(true);
    try {
      await onWaiter(finalReason);
      setSent(true);
    } finally {
      setCalling(false);
    }
  }

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-4 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Mesa {tableId}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Chamar Garçom</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Precisa de atendimento? Sua solicitação vai direto para a equipe no salão.
        </p>
      </div>

      <Card className="border-red-500/30 bg-gradient-to-b from-white/[0.06] to-black/80 p-6 sm:p-8 text-center shadow-xl">
        <div className="relative mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full border border-red-500/30 bg-red-600/10 shadow-[0_0_35px_rgba(215,25,32,0.25)]">
          <Bell className={cn("h-12 w-12 text-red-400 transition-all", calling && "animate-bounce", sent && "text-emerald-400 scale-110")} />
        </div>

        {sent ? (
          <div className="space-y-2">
            <Badge className="border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
              ✓ Garçom Chamado
            </Badge>
            <h2 className="text-lg sm:text-xl font-bold text-white">Equipe Notificada!</h2>
            <p className="text-xs sm:text-sm text-zinc-300">
              A equipe da Mesa {tableId} já recebeu seu chamado e logo vem ao seu encontro.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCall()}
              disabled={calling}
              className="mt-3 border-white/10 text-xs sm:text-sm text-zinc-300 hover:text-white"
            >
              {calling ? "Chamando..." : "Chamar novamente se demorar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">Chamar atendimento agora</h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Clique no botão para notificar o garçom responsável pela sua mesa.
            </p>

            <Button
              onClick={() => handleCall()}
              disabled={calling}
              className="w-full h-14 bg-red-600 hover:bg-red-500 text-base font-extrabold shadow-lg shadow-red-950/50"
            >
              <Bell className="mr-2 h-5 w-5" />
              {calling ? "Chamando garçom..." : "Chamar Garçom"}
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold text-zinc-400">Motivo rápido (opcional):</p>
        <div className="flex flex-wrap gap-2">
          {quickReasons.map((reason) => (
            <button
              key={reason}
              onClick={() => {
                setSelectedReason(reason);
                if (!sent) handleCall(reason);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-medium transition",
                selectedReason === reason
                  ? "border-red-500/60 bg-red-600/20 text-white"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
              )}
            >
              {reason}
            </button>
          ))}
        </div>
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
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto py-2">
      <h1 className="mb-1 text-2xl sm:text-3xl font-semibold">Pedido de música</h1>
      <p className="mb-5 text-sm text-zinc-500">Mande sua sugestão para a equipe avaliar e tocar quando puder.</p>
      <div className="space-y-3">
        <Card className="border-white/10 bg-white/[0.045] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-red-300">Mesa {tableId}</p>
          <div className="mt-4 space-y-3">
            <Input value={musicTitle} onChange={(event) => setMusicTitle(event.target.value)} placeholder="Nome da música" className="h-11 sm:h-12 text-sm sm:text-base" />
            <Input value={musicArtist} onChange={(event) => setMusicArtist(event.target.value)} placeholder="Artista ou banda" className="h-11 sm:h-12 text-sm sm:text-base" />
            <Input value={musicNotes} onChange={(event) => setMusicNotes(event.target.value)} placeholder="Recado opcional para a equipe" className="h-11 sm:h-12 text-sm sm:text-base" />
            <Button className="w-full font-bold h-12 text-sm sm:text-base" onClick={sendMusicRequest} disabled={loading || !musicTitle.trim()}>
              {loading ? "Enviando..." : "Pedir música"}
            </Button>
          </div>
        </Card>

        <Card className="border-white/10 bg-black/45 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Music2 className="h-5 w-5 text-red-300 shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Como funciona</p>
              <p className="text-xs sm:text-sm text-zinc-500">O pedido vai para o painel interno e a equipe marca quando tocar.</p>
            </div>
          </div>
        </Card>

        {musicSent && (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Pedido de música enviado para a equipe!
          </Card>
        )}
      </div>
    </motion.section>
  );
}

function CustomerNav({ active, setStep, cartCount }: { active: Step; setStep: (step: Step) => void; cartCount: number }) {
  const items = [
    ["menu", Utensils, "Cardápio"],
    ["cart", ShoppingBag, "Fazer Pedido"],
    ["music", Music2, "Pedir Música"],
    ["waiter", Bell, "Chamar Garçom"]
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 w-full border-t border-white/10 bg-black/95 backdrop-blur-xl">
      <div className="mx-auto grid max-w-4xl grid-cols-4 px-2 py-2.5 min-[520px]:py-3">
        {items.map(([step, Icon, label]) => {
          const isActive = active === step;
          return (
            <button
              key={step}
              onClick={() => setStep(step)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] min-[520px]:text-xs font-medium transition-colors",
                isActive ? "text-red-500 font-bold" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 min-[520px]:h-6 min-[520px]:w-6 transition-transform", isActive && "scale-110")} />
                {step === "cart" && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow">
                    {cartCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}



