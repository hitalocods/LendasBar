"use client";

import Image from "next/image";
import { Camera, Pencil, Search, Trash2, Upload } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "./types";
import { Field } from "./field";

export function MenuManager() {
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
    consumerCode: "",
    isFeatured: false,
    isPromo: false,
    promoPrice: ""
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
        price: Number(form.price.replace(",", ".")),
        promoPrice: form.promoPrice ? Number(form.promoPrice.replace(",", ".")) : null
      })
    });

    if (!response.ok) return;

    setEditingId(null);
    setForm({
      name: "",
      description: "",
      category: form.category,
      price: "",
      imageUrl: "",
      consumerCode: "",
      isFeatured: false,
      isPromo: false,
      promoPrice: ""
    });
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
      consumerCode: product.consumerCode ?? "",
      isFeatured: Boolean(product.isFeatured),
      isPromo: Boolean(product.isPromo),
      promoPrice: product.promoPrice ? String(product.promoPrice).replace(".", ",") : ""
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
    <div className="grid gap-5 lg:grid-cols-[340px_1fr] xl:grid-cols-[390px_1fr]">
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
            <Field label="Preco (R$)">
              <Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="29,90" />
            </Field>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-900 text-red-600 focus:ring-red-500"
              />
              🔥 Destaque no Carrossel (Mais Pedidos)
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={form.isPromo}
                onChange={(e) => setForm({ ...form, isPromo: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-900 text-red-600 focus:ring-red-500"
              />
              🏷️ Oferta do Dia / Promoção
            </label>

            {form.isPromo && (
              <Field label="Preço Promocional (R$)">
                <Input
                  value={form.promoPrice}
                  onChange={(event) => setForm({ ...form, promoPrice: event.target.value })}
                  placeholder="Ex: 24,90"
                />
              </Field>
            )}
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  {product.isFeatured && (
                    <Badge className="bg-red-600/80 text-[10px] px-1.5 py-0 text-white font-bold">
                      🔥 Destaque
                    </Badge>
                  )}
                  {product.isPromo && (
                    <Badge className="bg-amber-500/20 border-amber-500/40 text-amber-300 text-[10px] px-1.5 py-0 font-bold">
                      🏷️ Promo
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{product.desc}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <Badge>{product.category}</Badge>
                    <div className="mt-2 flex items-center gap-2">
                      <p className={cn("text-sm font-semibold", product.isPromo ? "text-zinc-500 line-through text-xs" : "text-red-300")}>
                        {formatCurrency(product.price)}
                      </p>
                      {product.isPromo && product.promoPrice && (
                        <p className="text-sm font-bold text-emerald-400">
                          {formatCurrency(product.promoPrice)}
                        </p>
                      )}
                    </div>
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
