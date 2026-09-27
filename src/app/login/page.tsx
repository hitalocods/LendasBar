import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createStaffSessionToken, hashPassword, STAFF_SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function login(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "").trim();
  const safeNext = (String(formData.get("next") ?? "/admin").trim() || "/admin") as any;

  if (!password) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&error=1` as any);
  }

  const db = getDb();
  let restaurant = await db.restaurant.findFirst({
    where: { slug: "lendas-2018" },
    select: { id: true, name: true }
  });

  if (!restaurant) {
    restaurant = await db.restaurant.create({
      data: {
        name: "LENDAS 2018",
        slug: "lendas-2018",
        accent: "#d71920",
        background: "#050505",
        logoUrl: "/lendas-logo.png"
      },
      select: { id: true, name: true }
    });
  }

  let sessionPayload = null;

  // Master login com a senha rui2026
  if (password === "rui2026") {
    let ruiUser = await db.user.findFirst({
      where: {
        restaurantId: restaurant.id,
        OR: [
          { role: "OWNER" },
          { email: "rui@lendas.local" },
          { name: { contains: "Rui", mode: "insensitive" } }
        ]
      }
    });

    if (!ruiUser) {
      ruiUser = await db.user.create({
        data: {
          restaurantId: restaurant.id,
          name: "Rui",
          email: "rui@lendas.local",
          role: "OWNER",
          passwordHash: hashPassword("rui2026")
        }
      });
    } else if (!ruiUser.passwordHash || !verifyPassword("rui2026", ruiUser.passwordHash)) {
      await db.user.update({
        where: { id: ruiUser.id },
        data: {
          role: "OWNER",
          passwordHash: hashPassword("rui2026")
        }
      });
    }

    sessionPayload = {
      userId: ruiUser.id,
      restaurantId: ruiUser.restaurantId,
      role: "OWNER" as const,
      name: ruiUser.name,
      email: ruiUser.email
    };
  } else {
    // Tenta autenticar por senha caso algum outro usuário possua senha cadastrada
    const users = await db.user.findMany({
      where: {
        restaurantId: restaurant.id,
        passwordHash: { not: null }
      },
      select: {
        id: true,
        restaurantId: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true
      }
    });

    const matchedUser = users.find(
      (u) => u.passwordHash && verifyPassword(password, u.passwordHash)
    );

    if (matchedUser) {
      sessionPayload = {
        userId: matchedUser.id,
        restaurantId: matchedUser.restaurantId,
        role: matchedUser.role,
        name: matchedUser.name,
        email: matchedUser.email
      };
    }
  }

  if (!sessionPayload) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}&error=1` as any);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    STAFF_SESSION_COOKIE,
    createStaffSessionToken(sessionPayload),
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
      <Card className="w-full max-w-sm border-white/10 bg-black/70 p-6 shadow-2xl backdrop-blur-md">
        <div className="relative mx-auto mb-5 h-20 w-20 overflow-hidden rounded-full border border-red-500/40 shadow-inner">
          <Image src="/lendas-logo.png" alt="LENDAS 2018" fill className="object-cover" priority />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">Acesso ao Painel</h1>
        <p className="mt-1 text-center text-sm text-zinc-400">Digite a senha para acessar o sistema.</p>

        <form action={login} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <Input
              name="password"
              type="password"
              placeholder="Digite sua senha..."
              autoComplete="current-password"
              autoFocus
              required
              className="border-white/15 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-red-500"
            />
          </div>

          {params.error && (
            <p className="text-center text-sm font-medium text-red-400">
              Senha incorreta. Tente novamente.
            </p>
          )}

          <Button className="w-full bg-red-600 font-bold text-white hover:bg-red-700 transition-colors" type="submit">
            Entrar no Sistema
          </Button>
        </form>
      </Card>
    </main>
  );
}
