import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupController } from './backup.controller';
import { BackupService } from '../common/services/backup.service';

@Module({
  providers: [AdminService, BackupService],
  controllers: [AdminController, BackupController],
  exports: [AdminService],
})
export class AdminModule {}
