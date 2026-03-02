-- AlterTable
ALTER TABLE "Refresh" ADD COLUMN     "bookingConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingDate" TIMESTAMP(3),
ADD COLUMN     "bookingTimeSlot" TEXT;
