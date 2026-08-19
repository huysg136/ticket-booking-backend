ALTER TABLE "Booking" ADD COLUMN "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Voucher" ADD COLUMN "minOrderAmount" DECIMAL(12,2);
ALTER TABLE "Voucher" ADD COLUMN "maxDiscountAmount" DECIMAL(12,2);
CREATE INDEX "Concert_status_idx" ON "Concert"("status");
CREATE INDEX "Concert_startAt_idx" ON "Concert"("startAt");
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");
