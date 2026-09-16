ALTER TABLE "attendees"
ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "events"
DROP COLUMN IF EXISTS "capacity",
DROP COLUMN IF EXISTS "location",
DROP COLUMN IF EXISTS "publicRegistrationEnabled";

-- Add token as nullable first
ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "publicRegistrationToken" TEXT;
-- Generate a unique token for existing events
UPDATE "events"
SET "publicRegistrationToken" = gen_random_uuid()::text
WHERE "publicRegistrationToken" IS NULL;

-- Make the token required
ALTER TABLE "events"
ALTER COLUMN "publicRegistrationToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "events_publicRegistrationToken_key"
ON "events"("publicRegistrationToken");
-- Remove old user role
ALTER TABLE "users"
DROP COLUMN IF EXISTS "role";

-- Remove old enum
DROP TYPE IF EXISTS "UserRole";