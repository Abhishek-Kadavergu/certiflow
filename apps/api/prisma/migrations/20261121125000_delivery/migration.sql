DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
        CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
    END IF;
END $$;

CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Delivery_certificateId_key" ON "Delivery"("certificateId");

ALTER TABLE "Delivery"
ADD CONSTRAINT "Delivery_certificateId_fkey"
FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
