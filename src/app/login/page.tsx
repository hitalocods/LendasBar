import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createStaffSessionToken, STAFF_SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const safeNext = next === "/kitchen" || next === "/waiter" ? next : "/admin";

  if (!email || !password) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&error=1`);
  }

  const db = getDb();
  const restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true }
  });

  const user = restaurant
    ? await db.user.findFirst({
        where: {
          restaurantId: restaurant.id,
          email
        },
        select: {
          id: true,
          restaurantId: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true
        }
      })
    : null;

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    STAFF_SESSION_COOKIE,
    createStaffSessionToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
      name: user.name,
      email: user.email
    }),
    {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
    }
  );

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
        <p className="mt-2 text-center text-sm text-zinc-500">Entre com email e senha da equipe.</p>
        <form action={login} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input name="email" type="email" placeholder="Email (ex: rui@lendas.local)" autoComplete="email" />
          <Input name="password" type="password" placeholder="Senha (ex: rui@2018)" autoComplete="current-password" />
          {params.error && <p className="text-sm text-red-300 text-center font-medium">Credenciais inválidas ou sem acesso a esta área.</p>}
          <Button className="w-full font-bold" type="submit">Entrar no Sistema</Button>
        </form>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs space-y-1.5 text-zinc-400">
          <p className="font-semibold text-zinc-300">🔑 Credenciais de Acesso:</p>
          <p><strong className="text-red-300">Admin/Dono:</strong> owner@lendas.local | owner@2018</p>
          <p><strong className="text-amber-300">Cozinha:</strong> cozinha@lendas.local | kitchen@2018</p>
          <p><strong className="text-sky-300">Garçons:</strong> joao@lendas.local | joao@2018</p>
        </div>
      </Card>
    </main>
  );
}
