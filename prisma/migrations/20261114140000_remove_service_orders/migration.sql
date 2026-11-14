-- DropForeignKey
ALTER TABLE "FinancialTransaction" DROP CONSTRAINT "FinancialTransaction_serviceOrderId_fkey";

-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_serviceOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrder" DROP CONSTRAINT "ServiceOrder_customerId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrder" DROP CONSTRAINT "ServiceOrder_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrderItem" DROP CONSTRAINT "ServiceOrderItem_serviceOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceOrderStatusLog" DROP CONSTRAINT "ServiceOrderStatusLog_serviceOrderId_fkey";

-- AlterTable
ALTER TABLE "FinancialTransaction" DROP COLUMN "serviceOrderId";

-- AlterTable
ALTER TABLE "PricingSettings" DROP COLUMN "warrantyAlertDays";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "serviceOrderId";

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "orderSeq";

-- DropTable
DROP TABLE "ServiceOrder";

-- DropTable
DROP TABLE "ServiceOrderItem";

-- DropTable
DROP TABLE "ServiceOrderStatusLog";

-- DropEnum
DROP TYPE "ServiceOrderStatus";

