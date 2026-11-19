# LENDAS 2018

Cardápio digital + painel do dono, integrado ao PDV Consumer.

- Cliente (mesa): `/mesa/[id]`
- Painel do dono: `/admin` (login em `/login`)

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand, Prisma, PostgreSQL (Neon), Cloudinary e PWA.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:3000`.

## Ambiente

Copie `.env.example` para `.env` e preencha os valores (banco, Cloudinary, `AUTH_SECRET`, integração Consumer e `CRON_SECRET`). Depois:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

## Deploy

Pronto para Vercel. Configure as mesmas variáveis do `.env.example` no painel da Vercel.
