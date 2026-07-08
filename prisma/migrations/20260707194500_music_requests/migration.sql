-- Create music requests table.
CREATE TABLE "MusicRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedAt" TIMESTAMP(3),

    CONSTRAINT "MusicRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MusicRequest" ADD CONSTRAINT "MusicRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicRequest" ADD CONSTRAINT "MusicRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicRequest" ADD CONSTRAINT "MusicRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MusicRequest_restaurantId_status_createdAt_idx" ON "MusicRequest"("restaurantId", "status", "createdAt");
CREATE INDEX "MusicRequest_tableId_status_idx" ON "MusicRequest"("tableId", "status");
CREATE INDEX "MusicRequest_sessionId_status_idx" ON "MusicRequest"("sessionId", "status");