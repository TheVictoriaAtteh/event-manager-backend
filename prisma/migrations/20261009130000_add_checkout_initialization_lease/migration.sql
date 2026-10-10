ALTER TABLE "payment_orders"
ADD COLUMN "activeCheckoutKey" TEXT;

ALTER TABLE "payment_orders"
ADD COLUMN "initializationClaimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "payment_orders_activeCheckoutKey_key"
ON "payment_orders"("activeCheckoutKey");
