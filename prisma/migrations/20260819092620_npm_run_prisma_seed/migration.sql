-- Compatibility migration: these columns may not exist yet on a fresh database
-- because the original migration was created with an earlier timestamp.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Booking'
      AND column_name = 'subtotalAmount'
  ) THEN
    ALTER TABLE "Booking"
      ALTER COLUMN "subtotalAmount" DROP DEFAULT,
      ALTER COLUMN "discountAmount" DROP DEFAULT;
  END IF;
END $$;
