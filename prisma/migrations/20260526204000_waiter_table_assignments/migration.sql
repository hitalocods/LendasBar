-- Add waiter assignment support
ALTER TABLE "Table" ADD COLUMN "assignedWaiterId" TEXT;
ALTER TABLE "WaiterCall" ADD COLUMN "assignedWaiterId" TEXT;

ALTER TABLE "Table" ADD CONSTRAINT "Table_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Table_assignedWaiterId_idx" ON "Table"("assignedWaiterId");
CREATE INDEX "WaiterCall_assignedWaiterId_status_idx" ON "WaiterCall"("assignedWaiterId", "status");
