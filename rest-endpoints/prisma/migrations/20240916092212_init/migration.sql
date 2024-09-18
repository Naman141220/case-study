-- CreateTable
CREATE TABLE `Customer` (
    `customerId` INTEGER NOT NULL,
    `password` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerMail` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerCurrPlan` INTEGER NOT NULL,

    UNIQUE INDEX `Customer_customerMail_key`(`customerMail`),
    PRIMARY KEY (`customerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `planId` INTEGER NOT NULL,
    `planName` VARCHAR(191) NOT NULL,
    `ratePerUnit` DOUBLE NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Plan_planName_key`(`planName`),
    PRIMARY KEY (`planId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,

    UNIQUE INDEX `CustomerPlan_customerId_planId_key`(`customerId`, `planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrepaidPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `unitsAvailable` DOUBLE NOT NULL,
    `prepaidBalance` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostpaidPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `unitsUsed` DOUBLE NOT NULL,
    `billingCycle` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `invoiceId` INTEGER NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `units` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `planType` ENUM('PREPAID', 'POSTPAID') NOT NULL,

    PRIMARY KEY (`invoiceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerPlan` ADD CONSTRAINT `CustomerPlan_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`customerId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPlan` ADD CONSTRAINT `CustomerPlan_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`planId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrepaidPlan` ADD CONSTRAINT `PrepaidPlan_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`planId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostpaidPlan` ADD CONSTRAINT `PostpaidPlan_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`planId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`customerId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`planId`) ON DELETE RESTRICT ON UPDATE CASCADE;
