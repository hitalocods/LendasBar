# LENDAS 2018

Premium realtime restaurant operating system with separated experiences:

- Customer app: `/mesa/[id]`
- Kitchen dashboard: `/kitchen`
- Admin panel: `/admin`

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn-style components, Framer Motion, Zustand, Prisma, PostgreSQL/Neon and PWA support.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Environment

Create `.env` from `.env.example`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/lendas2018?sslmode=require"
UPLOADTHING_TOKEN=""
AUTH_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_BRAND_HANDLE="@atlassoftware_"
NEXT_PUBLIC_MARKETING_COPY="Peça direto no QR e viva a experiência da casa."
```

Then run:

```bash
npx prisma generate
npx prisma migrate dev
```

## Deploy

The project is ready for Vercel. Configure `DATABASE_URL` and upload provider secrets in Vercel environment variables before production deploy.
