-- CreateTable
CREATE TABLE "DatasetSnapshot" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DatasetSnapshot_slug_key" ON "DatasetSnapshot"("slug");

-- CreateIndex
CREATE INDEX "DatasetSnapshot_createdAt_idx" ON "DatasetSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "DatasetSnapshot" ADD CONSTRAINT "DatasetSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
