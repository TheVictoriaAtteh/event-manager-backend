-- Baseline migration: initial schema (baselined from the already-provisioned
-- event_manager_v2 database; matches prisma/schema.prisma).
-- Marked as applied via `prisma migrate resolve --applied 0_init`.

CREATE TYPE "UserRole" AS ENUM ('ATTENDEE', 'ADMIN');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'EVENT', 'TASK', 'PASS');

-- ---------------------------------------------------------------------------
-- Users & organizations
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "supabaseUserId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATTENDEE',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "logoUrl" TEXT,
    "brandColor" VARCHAR(50),
    "address" TEXT,
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organizations_ownerId_idx" ON "organizations"("ownerId");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Halls & events
-- ---------------------------------------------------------------------------

CREATE TABLE "halls" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "capacity" INTEGER,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "halls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "halls_organizationId_idx" ON "halls"("organizationId");

ALTER TABLE "halls" ADD CONSTRAINT "halls_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Events & attendees & passes & check-ins
-- ---------------------------------------------------------------------------

CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "logoUrl" TEXT,
    "brandColor" VARCHAR(50),
    "capacity" INTEGER,
    "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicRegistrationCapacity" INTEGER,
    "hallId" UUID,
    "organizationId" UUID,
    "organizerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_hallId_idx" ON "events"("hallId");
CREATE INDEX "events_organizationId_idx" ON "events"("organizationId");
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");

ALTER TABLE "events" ADD CONSTRAINT "events_hallId_fkey"
  FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "attendees" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passType" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendees_eventId_email_key" ON "attendees"("eventId", "email");

ALTER TABLE "attendees" ADD CONSTRAINT "attendees_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "passes" (
    "id" UUID NOT NULL,
    "attendeeId" UUID NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "passes_attendeeId_idx" ON "passes"("attendeeId");

ALTER TABLE "passes" ADD CONSTRAINT "passes_attendeeId_fkey"
  FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "passId" UUID NOT NULL,
    "scannedById" UUID,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "check_ins_passId_key" ON "check_ins"("passId");
CREATE INDEX "check_ins_scannedAt_idx" ON "check_ins"("scannedAt");

ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_passId_fkey"
  FOREIGN KEY ("passId") REFERENCES "passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_scannedById_fkey"
  FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Tasks & notifications & files
-- ---------------------------------------------------------------------------

CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "eventId" UUID NOT NULL,
    "assignedToId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_eventId_idx" ON "tasks"("eventId");
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "readAt" TIMESTAMP(3),
    "recipientId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipientId_readAt_idx" ON "notifications"("recipientId", "readAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(255) NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "files_storageKey_key" ON "files"("storageKey");
CREATE INDEX "files_uploadedById_idx" ON "files"("uploadedById");

ALTER TABLE "files" ADD CONSTRAINT "files_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
