import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="noise grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md border-white/10 bg-black/55 p-6 text-center">
        <div className="relative mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-red-500/40">
          <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" priority />
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-red-300">LENDAS 2018</p>
        <h1 className="mt-2 text-2xl font-semibold">Cardápio Digital & Som</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Integração automática com o Programa Consumer (PDV).
        </p>
        <div className="mt-6 grid gap-3">
          <Button asChild className="font-bold">
            <Link href="/mesa/1">Cardápio Digital (Mesa 01)</Link>
          </Button>
          <Button asChild variant="secondary" className="font-semibold">
            <Link href="/admin">Painel Administrativo & Música</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
