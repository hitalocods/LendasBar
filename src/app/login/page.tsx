import Image from "next/image";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACCESS_COOKIE, getStaffAccessValue } from "@/lib/auth";
import { cookies } from "next/headers";

async function login(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const safeNext = next === "/kitchen" || next === "/waiter" ? next : "/admin";
  const expected = process.env.STAFF_PASSWORD || "lendas2018";

  if (password !== expected) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, getStaffAccessValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  redirect(safeNext);
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || "/admin";

  return (
    <main className="noise grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-sm border-white/10 bg-black/60 p-6">
        <div className="relative mx-auto mb-5 h-20 w-20 overflow-hidden rounded-full border border-red-500/40">
          <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" priority />
        </div>
        <h1 className="text-center text-2xl font-semibold">Acesso da equipe</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">Entre para acessar cozinha e admin.</p>
        <form action={login} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input name="password" type="password" placeholder="Senha" />
          {params.error && <p className="text-sm text-red-300">Senha incorreta.</p>}
          <Button className="w-full" type="submit">Entrar</Button>
        </form>
      </Card>
    </main>
  );
}
