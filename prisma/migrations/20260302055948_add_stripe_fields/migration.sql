-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidEmail" TEXT,
ADD COLUMN     "selectedLayoutPaid" INTEGER,
ADD COLUMN     "stripePaymentStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "stripeSessionId" TEXT;
