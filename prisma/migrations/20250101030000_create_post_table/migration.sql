-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT,
    "imageUrl" TEXT,
    "imageStorageKey" TEXT,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "erasedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "Post" ADD CONSTRAINT "Post_likeCount_nonnegative" CHECK ("likeCount" >= 0);
ALTER TABLE "Post" ADD CONSTRAINT "Post_commentCount_nonnegative" CHECK ("commentCount" >= 0);

-- CreateIndex
CREATE INDEX "Post_visibility_deletedAt_createdAt_id_idx" ON "Post"("visibility", "deletedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_authorId_deletedAt_createdAt_idx" ON "Post"("authorId", "deletedAt", "createdAt");

-- CreatePartialIndex
CREATE INDEX "Post_public_active_feed_idx"
ON "Post" ("createdAt" DESC, "id" DESC)
WHERE "visibility" = 'PUBLIC' AND "deletedAt" IS NULL;

-- CreatePartialIndex
CREATE INDEX "Post_author_active_feed_idx"
ON "Post" ("authorId", "createdAt" DESC, "id" DESC)
WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
