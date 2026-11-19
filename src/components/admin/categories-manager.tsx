"use client";

import { ToggleLeft, ToggleRight } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "./field";

type CategoryItem = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

export function CategoriesManager() {
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
    <div className="grid gap-5 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
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
