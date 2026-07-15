-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT,
    "parentId" TEXT,
    "text" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "erasedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_likeCount_nonnegative" CHECK ("likeCount" >= 0);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_replyCount_nonnegative" CHECK ("replyCount" >= 0);

-- CreateIndex
CREATE INDEX "Comment_postId_parentId_deletedAt_createdAt_id_idx" ON "Comment"("postId", "parentId", "deletedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Comment_authorId_deletedAt_idx" ON "Comment"("authorId", "deletedAt");

-- CreatePartialIndex
CREATE INDEX "Comment_post_parent_active_idx"
ON "Comment" ("postId", "parentId", "createdAt" DESC, "id" DESC)
WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
