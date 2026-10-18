/*
  Warnings:

  - You are about to drop the column `stripeVerificationSessionId` on the `House` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_House" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "candies" TEXT NOT NULL DEFAULT '[]',
    "allergenFree" TEXT NOT NULL DEFAULT '[]',
    "nonFoodTreats" BOOLEAN NOT NULL DEFAULT false,
    "hoursStart" TEXT NOT NULL DEFAULT '17:00',
    "hoursEnd" TEXT NOT NULL DEFAULT '20:30',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT,
    "verifiedName" TEXT,
    "addressMatchesId" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "idDocumentType" TEXT,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "verificationWindowStart" DATETIME,
    "verifiedAt" DATETIME,
    "safetyFlag" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "House_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_House" ("active", "address", "addressMatchesId", "allergenFree", "candies", "createdAt", "displayName", "hoursEnd", "hoursStart", "id", "lat", "legalName", "lng", "nonFoodTreats", "ownerId", "safetyFlag", "verificationNote", "verificationStatus", "verifiedAt", "verifiedName") SELECT "active", "address", "addressMatchesId", "allergenFree", "candies", "createdAt", "displayName", "hoursEnd", "hoursStart", "id", "lat", "legalName", "lng", "nonFoodTreats", "ownerId", "safetyFlag", "verificationNote", "verificationStatus", "verifiedAt", "verifiedName" FROM "House";
DROP TABLE "House";
ALTER TABLE "new_House" RENAME TO "House";
CREATE INDEX "House_lat_lng_idx" ON "House"("lat", "lng");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
