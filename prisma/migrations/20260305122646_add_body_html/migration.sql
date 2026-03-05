-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderName" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "bodyPreview" TEXT NOT NULL DEFAULT '',
    "receivedDate" DATETIME NOT NULL,
    "bucket" TEXT NOT NULL,
    "importanceScore" REAL NOT NULL DEFAULT 0,
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "correctedBucket" TEXT,
    "correctedAt" DATETIME,
    "correctedBy" TEXT,
    "rawResponse" TEXT,
    "classifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Email" ("bodyPreview", "bodyText", "bucket", "classifiedAt", "correctedAt", "correctedBucket", "correctedBy", "createdAt", "exchangeId", "id", "importanceScore", "isEscalated", "rawResponse", "receivedDate", "sender", "senderName", "subject", "updatedAt") SELECT "bodyPreview", "bodyText", "bucket", "classifiedAt", "correctedAt", "correctedBucket", "correctedBy", "createdAt", "exchangeId", "id", "importanceScore", "isEscalated", "rawResponse", "receivedDate", "sender", "senderName", "subject", "updatedAt" FROM "Email";
DROP TABLE "Email";
ALTER TABLE "new_Email" RENAME TO "Email";
CREATE UNIQUE INDEX "Email_exchangeId_key" ON "Email"("exchangeId");
CREATE INDEX "Email_receivedDate_idx" ON "Email"("receivedDate");
CREATE INDEX "Email_bucket_idx" ON "Email"("bucket");
CREATE INDEX "Email_isEscalated_idx" ON "Email"("isEscalated");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
