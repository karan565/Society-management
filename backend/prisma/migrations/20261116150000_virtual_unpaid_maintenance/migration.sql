BEGIN;

ALTER TABLE "MaintenancePayment"
ADD COLUMN "societyId" UUID,
ADD COLUMN "userId" UUID,
ADD COLUMN "month" VARCHAR(7);

UPDATE "MaintenancePayment" AS payment
SET
  "societyId" = bill."societyId",
  "userId" = bill."userId",
  "month" = bill."month"
FROM "MaintenanceBill" AS bill
WHERE payment."billId" = bill."id";

ALTER TABLE "MaintenancePayment"
ALTER COLUMN "societyId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "month" SET NOT NULL,
ALTER COLUMN "billId" DROP NOT NULL;

ALTER TABLE "MaintenancePayment"
DROP CONSTRAINT "MaintenancePayment_billId_fkey";

ALTER TABLE "MaintenancePayment"
ADD CONSTRAINT "MaintenancePayment_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "MaintenanceBill"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "MaintenancePayment" AS payment
SET
  "billId" = NULL,
  "status" = 'REVERTED',
  "revertedAt" = COALESCE(payment."revertedAt", CURRENT_TIMESTAMP)
FROM "MaintenanceBill" AS bill
WHERE payment."billId" = bill."id"
  AND bill."status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentRequest" AS request
    WHERE request."billId" = bill."id"
      AND request."status" = 'PENDING'
  );

DELETE FROM "MaintenanceBill" AS bill
WHERE bill."status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentRequest" AS request
    WHERE request."billId" = bill."id"
      AND request."status" = 'PENDING'
  );

CREATE INDEX "MaintenancePayment_societyId_status_paidAt_idx"
ON "MaintenancePayment"("societyId", "status", "paidAt");

CREATE INDEX "MaintenancePayment_userId_month_status_idx"
ON "MaintenancePayment"("userId", "month", "status");

COMMIT;
