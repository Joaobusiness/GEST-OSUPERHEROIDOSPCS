-- AlterTable: lembrete simples de cliente devendo (aditivo, sem dados a migrar)
ALTER TABLE "Customer" ADD COLUMN "owes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "owedAmount" DECIMAL(12,2),
ADD COLUMN "owedDueDate" DATE;
