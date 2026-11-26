-- Schema original, do commit 8a4fd12, anterior ao histórico do Prisma Migrate.
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "currentInstallment" INTEGER,
    "totalInstallments" INTEGER,
    "groupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "transactions_date_idx" ON "transactions"("date");
CREATE INDEX "transactions_groupId_idx" ON "transactions"("groupId");
CREATE INDEX "transactions_category_idx" ON "transactions"("category");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");
