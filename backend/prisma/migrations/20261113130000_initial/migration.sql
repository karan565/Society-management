CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'RESIDENT');
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'CHEQUE', 'NEFT', 'RTGS', 'OTHER');
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED');
CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "ComplaintType" AS ENUM ('COMPLAINT', 'SUGGESTION');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'REJECTED', 'CLOSED', 'COMPLETED');
CREATE TYPE "MaintenancePaymentStatus" AS ENUM ('RECORDED', 'REVERTED');

CREATE TABLE "Society" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(500) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expensesVisibleToResidents" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 3500,
    "maintenanceEffectiveFrom" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "societyId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "apartment" VARCHAR(80) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceOverride" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceBill" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "paymentReference" VARCHAR(160) NOT NULL DEFAULT '',
    "paymentNotes" VARCHAR(1000) NOT NULL DEFAULT '',
    "paymentAcceptedById" UUID,
    "paymentAcceptedByName" VARCHAR(160) NOT NULL DEFAULT '',
    "paymentRecordedAt" TIMESTAMP(3),
    "receiptNo" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceBill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRequest" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paymentDate" DATE NOT NULL,
    "reference" VARCHAR(160) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" UUID NOT NULL,
    "reviewedById" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenancePayment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "recordedById" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(160) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "receiptNo" VARCHAR(64) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "status" "MaintenancePaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenancePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialTransaction" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Complaint" (
    "id" UUID NOT NULL,
    "societyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "societyId" UUID,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Society_isActive_idx" ON "Society"("isActive");
CREATE INDEX "User_societyId_role_idx" ON "User"("societyId", "role");
CREATE INDEX "User_societyId_isActive_idx" ON "User"("societyId", "isActive");
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "MaintenanceOverride_societyId_month_key" ON "MaintenanceOverride"("societyId", "month");
CREATE UNIQUE INDEX "MaintenanceBill_receiptNo_key" ON "MaintenanceBill"("receiptNo");
CREATE UNIQUE INDEX "MaintenanceBill_societyId_userId_month_key" ON "MaintenanceBill"("societyId", "userId", "month");
CREATE INDEX "MaintenanceBill_societyId_month_status_idx" ON "MaintenanceBill"("societyId", "month", "status");
CREATE INDEX "MaintenanceBill_userId_month_status_idx" ON "MaintenanceBill"("userId", "month", "status");
CREATE UNIQUE INDEX "PaymentRequest_billId_key" ON "PaymentRequest"("billId");
CREATE INDEX "PaymentRequest_status_submittedAt_idx" ON "PaymentRequest"("status", "submittedAt");
CREATE UNIQUE INDEX "MaintenancePayment_receiptNo_key" ON "MaintenancePayment"("receiptNo");
CREATE INDEX "MaintenancePayment_billId_status_idx" ON "MaintenancePayment"("billId", "status");
CREATE INDEX "MaintenancePayment_paidAt_status_idx" ON "MaintenancePayment"("paidAt", "status");
CREATE INDEX "FinancialTransaction_societyId_date_type_idx" ON "FinancialTransaction"("societyId", "date", "type");
CREATE INDEX "Complaint_societyId_status_createdAt_idx" ON "Complaint"("societyId", "status", "createdAt");
CREATE INDEX "Complaint_userId_createdAt_idx" ON "Complaint"("userId", "createdAt");
CREATE INDEX "AuditLog_societyId_createdAt_idx" ON "AuditLog"("societyId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceOverride" ADD CONSTRAINT "MaintenanceOverride_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceBill" ADD CONSTRAINT "MaintenanceBill_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceBill" ADD CONSTRAINT "MaintenanceBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceBill" ADD CONSTRAINT "MaintenanceBill_paymentAcceptedById_fkey" FOREIGN KEY ("paymentAcceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MaintenanceBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MaintenanceBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
