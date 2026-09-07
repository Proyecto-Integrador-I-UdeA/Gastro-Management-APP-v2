-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UNATTACHED', 'ATTACHED', 'PENDING_DELETE');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UNATTACHED',
    "uploadedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedAt" TIMESTAMP(3),
    "cleanupRequestedAt" TIMESTAMP(3),
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastCleanupError" TEXT,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "imageAssetId" INTEGER;

-- AddCheckConstraints
ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_mimeType_check"
    CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'image/webp')),
ADD CONSTRAINT "media_assets_byteSize_check"
    CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
ADD CONSTRAINT "media_assets_dimensions_check"
    CHECK ("width" > 0 AND "height" > 0 AND "width" <= 10000 AND "height" <= 10000),
ADD CONSTRAINT "media_assets_pixelCount_check"
    CHECK (("width"::BIGINT * "height"::BIGINT) <= 40000000),
ADD CONSTRAINT "media_assets_checksumSha256_check"
    CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "media_assets_cleanupAttempts_check"
    CHECK ("cleanupAttempts" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_status_createdAt_idx" ON "media_assets"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_imageAssetId_key" ON "MenuItem"("imageAssetId");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
