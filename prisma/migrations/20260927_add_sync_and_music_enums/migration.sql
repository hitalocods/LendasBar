-- Migration: add_sync_and_music_enums
-- Converte syncStatus (String) → SyncStatus (enum) e
-- MusicRequest.status (String) → MusicRequestStatus (enum)
-- sem perda de dados.

-- ── SyncStatus ────────────────────────────────────────────────────────────────

-- 1. Criar o enum SyncStatus (ignora se já existe)
DO $$ BEGIN
  CREATE TYPE "SyncStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'SYNC_FAILED_PERMANENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Remover o DEFAULT antes do cast (o Postgres exige isso)
ALTER TABLE "Order" ALTER COLUMN "syncStatus" DROP DEFAULT;

-- 3. Converter a coluna (preserva os dados existentes)
ALTER TABLE "Order"
  ALTER COLUMN "syncStatus" TYPE "SyncStatus"
  USING "syncStatus"::"SyncStatus";

-- 4. Reaplicar o DEFAULT com o tipo correto
ALTER TABLE "Order"
  ALTER COLUMN "syncStatus" SET DEFAULT 'PENDING'::"SyncStatus";

-- ── MusicRequestStatus ────────────────────────────────────────────────────────

-- 5. Criar o enum MusicRequestStatus (ignora se já existe)
DO $$ BEGIN
  CREATE TYPE "MusicRequestStatus" AS ENUM ('OPEN', 'PLAYED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Remover o DEFAULT antes do cast
ALTER TABLE "MusicRequest" ALTER COLUMN "status" DROP DEFAULT;

-- 7. Converter a coluna (preserva os dados existentes)
ALTER TABLE "MusicRequest"
  ALTER COLUMN "status" TYPE "MusicRequestStatus"
  USING "status"::"MusicRequestStatus";

-- 8. Reaplicar o DEFAULT com o tipo correto
ALTER TABLE "MusicRequest"
  ALTER COLUMN "status" SET DEFAULT 'OPEN'::"MusicRequestStatus";
