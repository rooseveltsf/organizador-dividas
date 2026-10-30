-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatarInitials" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Criação de um Perfil padrão caso existam transações legadas sem profileId
INSERT OR IGNORE INTO "profiles" ("id", "name", "avatarInitials", "primaryColor", "secondaryColor", "createdAt", "updatedAt")
VALUES ('default-profile-id', 'Principal', 'PR', '#6366F1', '#EC4899', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_transactions" ("id", "profileId", "type", "category", "amount", "description", "date", "currentInstallment", "totalInstallments", "groupId", "status", "paymentDate", "createdAt", "updatedAt")
SELECT "id", 'default-profile-id' AS "profileId", "type", "category", "amount", "description", "date", "currentInstallment", "totalInstallments", "groupId", "status", "paymentDate", "createdAt", "updatedAt"
FROM "transactions";

DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";

CREATE INDEX "transactions_profileId_date_idx" ON "transactions"("profileId", "date");
CREATE INDEX "transactions_date_idx" ON "transactions"("date");
CREATE INDEX "transactions_groupId_idx" ON "transactions"("groupId");
CREATE INDEX "transactions_category_idx" ON "transactions"("category");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

