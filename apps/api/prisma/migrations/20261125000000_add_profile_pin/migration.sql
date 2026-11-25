ALTER TABLE "profiles" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "profiles" ADD COLUMN "pinAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profiles" ADD COLUMN "pinAttemptUntil" DATETIME;

CREATE TABLE "profile_sessions" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "profile_sessions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "profile_sessions_profileId_expiresAt_idx" ON "profile_sessions"("profileId", "expiresAt");
