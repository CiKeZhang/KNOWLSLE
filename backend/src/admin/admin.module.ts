import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupController } from './backup.controller';
import { DbTransferController } from './db-transfer.controller';
import { BackupService } from '../common/services/backup.service';

@Module({
  providers: [AdminService, BackupService],
  controllers: [AdminController, BackupController, DbTransferController],
  exports: [AdminService],
})
export class AdminModule {}
