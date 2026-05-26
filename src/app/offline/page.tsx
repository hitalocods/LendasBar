import Image from "next/image";
import { Card } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-sm border-white/10 bg-black/55 p-6 text-center">
        <div className="relative mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-red-500/40">
          <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" />
        </div>
        <h1 className="text-2xl font-semibold">Sem conexao</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Verifique a internet para sincronizar cardapio, pedidos e status da mesa.
        </p>
      </Card>
    </main>
  );
}
