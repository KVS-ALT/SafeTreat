-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARENT',
    "childAllergens" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "House" (
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
    "stripeVerificationSessionId" TEXT,
    "verifiedAt" DATETIME,
    "safetyFlag" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "House_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "placeName" TEXT NOT NULL,
    "candyDescription" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 3,
    "category" TEXT NOT NULL DEFAULT 'other',
    "aiSummary" TEXT NOT NULL DEFAULT '',
    "aiFlaggedSpam" BOOLEAN NOT NULL DEFAULT false,
    "aiSource" TEXT NOT NULL DEFAULT 'fallback',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reporterId" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedRoute" TEXT NOT NULL DEFAULT 'null',
    "waypoints" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackPoint_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "distanceM" REAL NOT NULL,
    "passedAt" DATETIME NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "House_lat_lng_idx" ON "House"("lat", "lng");

-- CreateIndex
CREATE INDEX "Report_lat_lng_idx" ON "Report"("lat", "lng");

-- CreateIndex
CREATE INDEX "TrackPoint_lat_lng_idx" ON "TrackPoint"("lat", "lng");

-- CreateIndex
CREATE INDEX "TrackPoint_tripId_idx" ON "TrackPoint"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_tripId_reportId_key" ON "Alert"("tripId", "reportId");
