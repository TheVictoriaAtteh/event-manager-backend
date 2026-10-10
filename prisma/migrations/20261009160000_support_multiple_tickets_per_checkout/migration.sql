ALTER TABLE "payment_orders"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "passes_paymentOrderId_key";
ALTER TABLE "passes"
ADD COLUMN "paymentOrderAttendeeId" TEXT;

CREATE TABLE "payment_order_attendees" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "emailClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_order_attendees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_order_attendees_paymentOrderId_email_key"
ON "payment_order_attendees"("paymentOrderId", "email");

CREATE INDEX "payment_order_attendees_email_idx"
ON "payment_order_attendees"("email");

CREATE UNIQUE INDEX "passes_paymentOrderAttendeeId_key"
ON "passes"("paymentOrderAttendeeId");

ALTER TABLE "payment_order_attendees"
ADD CONSTRAINT "payment_order_attendees_paymentOrderId_fkey"
FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "payment_order_attendees" (
    "id",
    "paymentOrderId",
    "name",
    "email",
    "emailSentAt",
    "emailClaimedAt",
    "createdAt"
)
SELECT
    gen_random_uuid()::TEXT,
    "id",
    "attendeeName",
    "attendeeEmail",
    "emailSentAt",
    "emailClaimedAt",
    "createdAt"
FROM "payment_orders";

UPDATE "passes" AS pass
SET "paymentOrderAttendeeId" = recipient."id"
FROM "attendees" AS attendee
JOIN "payment_order_attendees" AS recipient
  ON LOWER(recipient."email") = LOWER(attendee."email")
WHERE pass."attendeeId" = attendee."id"
  AND pass."paymentOrderId" = recipient."paymentOrderId";

ALTER TABLE "passes"
ADD CONSTRAINT "passes_paymentOrderAttendeeId_fkey"
FOREIGN KEY ("paymentOrderAttendeeId") REFERENCES "payment_order_attendees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
