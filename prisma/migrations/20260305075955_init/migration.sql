-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderName" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ClassificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bucket" TEXT NOT NULL,
    "ruleText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "originalBucket" TEXT NOT NULL,
    "correctedBucket" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailSender" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncStatus" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "lastSyncAt" DATETIME,
    "lastSyncCount" INTEGER NOT NULL DEFAULT 0,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Email_exchangeId_key" ON "Email"("exchangeId");

-- CreateIndex
CREATE INDEX "Email_receivedDate_idx" ON "Email"("receivedDate");

-- CreateIndex
CREATE INDEX "Email_bucket_idx" ON "Email"("bucket");

-- CreateIndex
CREATE INDEX "Email_isEscalated_idx" ON "Email"("isEscalated");
