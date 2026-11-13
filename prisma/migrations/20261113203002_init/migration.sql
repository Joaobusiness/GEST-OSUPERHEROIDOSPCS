-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('OPEN', 'DIAGNOSIS', 'WAITING_APPROVAL', 'WAITING_PARTS', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('PART', 'LABOR', 'OTHER');

-- CreateEnum
CREATE TYPE "UberMode" AS ENUM ('INCLUDED', 'SEPARATE', 'ABSORBED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('OPERATIONAL', 'MARKETING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" JSONB,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderSeq" INTEGER NOT NULL DEFAULT 0,
    "quoteSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("tenantId","userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "document" VARCHAR(20),
    "phone" VARCHAR(20) NOT NULL,
    "whatsapp" VARCHAR(20),
    "email" VARCHAR(150),
    "address" JSONB,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDevice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "accessories" TEXT,
    "conditionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "deviceId" UUID,
    "orderNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "diagnosis" TEXT,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'OPEN',
    "estimatedDeliveryAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "warrantyDays" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderStatusLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "fromStatus" "ServiceOrderStatus",
    "toStatus" "ServiceOrderStatus" NOT NULL,
    "userId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceOrderId" UUID,
    "number" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" UUID,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "uberMode" "UberMode" NOT NULL DEFAULT 'INCLUDED',
    "uberCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uberMarkup" BOOLEAN NOT NULL DEFAULT false,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extraFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "marginPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cardFeePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "executionDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "warranty" TEXT,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "approvalMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID,
    "quoteId" UUID,
    "customerId" UUID,
    "categoryId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "allocationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,

    CONSTRAINT "TransactionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "tenantId" UUID NOT NULL,
    "partMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "laborMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "minMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "cardFeePct" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 6,
    "defaultUberCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultUberMode" "UberMode" NOT NULL DEFAULT 'INCLUDED',
    "uberMarkup" BOOLEAN NOT NULL DEFAULT false,
    "otherCostsFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "inactiveDays" INTEGER NOT NULL DEFAULT 60,
    "warrantyAlertDays" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "PricingSimulation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "label" TEXT,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL DEFAULT 'OPERATIONAL',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "templateId" UUID,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInteraction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "kind" "TemplateKind" NOT NULL DEFAULT 'OPERATIONAL',
    "result" TEXT,
    "note" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_lastContactAt_idx" ON "Customer"("tenantId", "lastContactAt");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CustomerDevice_tenantId_customerId_idx" ON "CustomerDevice"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_status_idx" ON "ServiceOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ServiceOrder_tenantId_customerId_idx" ON "ServiceOrder"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_tenantId_orderNumber_key" ON "ServiceOrder"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_tenantId_serviceOrderId_idx" ON "ServiceOrderItem"("tenantId", "serviceOrderId");

-- CreateIndex
CREATE INDEX "ServiceOrderStatusLog_tenantId_serviceOrderId_idx" ON "ServiceOrderStatusLog"("tenantId", "serviceOrderId");

-- CreateIndex
CREATE INDEX "Quote_tenantId_status_idx" ON "Quote"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Quote_tenantId_customerId_idx" ON "Quote"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_tenantId_number_revision_key" ON "Quote"("tenantId", "number", "revision");

-- CreateIndex
CREATE INDEX "QuoteItem_tenantId_quoteId_idx" ON "QuoteItem"("tenantId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_tenantId_name_type_key" ON "FinancialCategory"("tenantId", "name", "type");

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_dueDate_idx" ON "FinancialTransaction"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_status_idx" ON "FinancialTransaction"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_tenantId_allocationKey_key" ON "FinancialTransaction"("tenantId", "allocationKey");

-- CreateIndex
CREATE INDEX "TransactionPayment_tenantId_paidAt_idx" ON "TransactionPayment"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "PricingSimulation_tenantId_createdAt_idx" ON "PricingSimulation"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_tenantId_idx" ON "CommunicationTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX "CampaignContact_tenantId_idx" ON "CampaignContact"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_campaignId_customerId_key" ON "CampaignContact"("campaignId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerInteraction_tenantId_customerId_idx" ON "CustomerInteraction"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDevice" ADD CONSTRAINT "CustomerDevice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CustomerDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderStatusLog" ADD CONSTRAINT "ServiceOrderStatusLog_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPayment" ADD CONSTRAINT "TransactionPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
