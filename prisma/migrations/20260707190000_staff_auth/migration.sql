-- Add staff passwords for session-based authentication.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;