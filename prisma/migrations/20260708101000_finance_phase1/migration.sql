CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "amountCents" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_restaurantId_occurredAt_idx" ON "Expense"("restaurantId", "occurredAt");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
