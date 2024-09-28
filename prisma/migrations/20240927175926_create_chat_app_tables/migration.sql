-- CreateEnum
CREATE TYPE "UserRolesEnum" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "role" "UserRolesEnum" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "ChatChannels" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT,
    "isGroupChat" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatChannels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannelMembers" (
    "userId" INTEGER NOT NULL,
    "chatChannelId" INTEGER NOT NULL,
    "role" "UserRolesEnum" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatChannelMembers_pkey" PRIMARY KEY ("userId","chatChannelId")
);

-- CreateTable
CREATE TABLE "ChatMessages" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chatChannelId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannels_uuid_key" ON "ChatChannels"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessages_uuid_key" ON "ChatMessages"("uuid");

-- AddForeignKey
ALTER TABLE "ChatChannels" ADD CONSTRAINT "ChatChannels_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannelMembers" ADD CONSTRAINT "ChatChannelMembers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannelMembers" ADD CONSTRAINT "ChatChannelMembers_chatChannelId_fkey" FOREIGN KEY ("chatChannelId") REFERENCES "ChatChannels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessages" ADD CONSTRAINT "ChatMessages_chatChannelId_fkey" FOREIGN KEY ("chatChannelId") REFERENCES "ChatChannels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessages" ADD CONSTRAINT "ChatMessages_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
