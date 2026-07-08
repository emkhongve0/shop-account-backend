/*
  Warnings:

  - A unique constraint covering the columns `[description]` on the table `deposits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bankTxId]` on the table `deposits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiredAt` to the `deposits` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `deposits` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `deposits` ADD COLUMN `bankTxId` VARCHAR(191) NULL,
    ADD COLUMN `expiredAt` DATETIME(3) NOT NULL,
    MODIFY `amount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `description` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `deposits_description_key` ON `deposits`(`description`);

-- CreateIndex
CREATE UNIQUE INDEX `deposits_bankTxId_key` ON `deposits`(`bankTxId`);

-- CreateIndex
CREATE INDEX `deposits_description_idx` ON `deposits`(`description`);
