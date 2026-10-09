import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { BackupService } from '../common/services/backup.service';
import { OperationLogService } from '../common/services/operation-log.service';

@ApiTags('数据备份与恢复')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/backup')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly opLog: OperationLogService,
  ) {}

  @Get('list')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:备份文件列表' })
  list() {
    return this.backup.listBackups();
  }

  @Post('create')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:手动触发数据库备份' })
  async create(@CurrentUser() user: AuthUser) {
    const result = await this.backup.createBackup();
    await this.opLog.record(user.id, 'backup_create', 'database', result);
    return result;
  }

  @Post('restore/:filename')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:一键恢复数据库(从指定备份文件)' })
  async restore(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.backup.restoreBackup(filename);
    await this.opLog.record(user.id, 'backup_restore', 'database', { filename });
    return result;
  }
}
