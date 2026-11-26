CREATE TABLE "shopping_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedAmount" REAL,
    "paymentMethod" TEXT,
    "installmentCount" INTEGER,
    "scheduledDate" TEXT,
    "actualAmount" REAL,
    "actualPaymentMethod" TEXT,
    "actualInstallmentCount" INTEGER,
    "actualDate" TEXT,
    "transactionId" TEXT,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasedAt" DATETIME,
    "archivedAt" DATETIME,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "shopping_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "shopping_items_profileId_createdAt_idx" ON "shopping_items"("profileId", "createdAt");
