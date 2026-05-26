-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'KITCHEN', 'WAITER', 'STAFF');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'WAITING_BILL', 'CLOSED');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('ACTIVE', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaiterCallType" AS ENUM ('WAITER', 'BILL');

-- CreateEnum
CREATE TYPE "WaiterCallStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "accent" TEXT NOT NULL DEFAULT '#d71920',
    "background" TEXT NOT NULL DEFAULT '#050505',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentSessionId" TEXT,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSessionUser" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSessionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionUserId" TEXT,
    "customerName" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiterCall" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "type" "WaiterCallType" NOT NULL,
    "status" "WaiterCallStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "WaiterCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_restaurantId_email_key" ON "User"("restaurantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Table_qrToken_key" ON "Table"("qrToken");

-- CreateIndex
CREATE INDEX "Table_restaurantId_qrToken_idx" ON "Table"("restaurantId", "qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Table_restaurantId_number_key" ON "Table"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "TableSession_restaurantId_tableId_status_idx" ON "TableSession"("restaurantId", "tableId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TableSessionUser_sessionId_clientId_key" ON "TableSessionUser"("sessionId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_restaurantId_name_key" ON "Category"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "Order_restaurantId_sessionId_status_idx" ON "Order"("restaurantId", "sessionId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_currentSessionId_fkey" FOREIGN KEY ("currentSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSessionUser" ADD CONSTRAINT "TableSessionUser_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sessionUserId_fkey" FOREIGN KEY ("sessionUserId") REFERENCES "TableSessionUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
