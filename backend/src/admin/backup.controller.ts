import {
  Controller,
  Get,
  Post,
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

/**
 * SQLite 数据库备份管理。
 * 备份落在 BACKUP_DIR(默认与 db 同目录的 backups/);若 /app/data 挂载了
 * 持久卷,这些备份即可跨部署保留。
 */
@ApiTags('数据备份与恢复')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/backup')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly opLog: OperationLogService,
  ) {}

  @Get('status')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:查看数据库与备份状态' })
  status() {
    return this.backup.status();
  }

  @Get('list')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:备份文件列表(含体积与 sha256)' })
  list() {
    return this.backup.listBackups();
  }

  @Post('create')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:手动触发一次 SQLite 快照' })
  async create(@CurrentUser() user: AuthUser) {
    const result = await this.backup.createBackup();
    await this.opLog.record(user.id, 'backup_create', 'database', result);
    return result;
  }

  @Post('restore/:filename')
  @Roles(UserRole.SYS_ADMIN)
  @ApiOperation({ summary: '系统管理员:从指定备份原子恢复数据库(恢复前自动留底)' })
  async restore(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.backup.restoreBackup(filename);
    await this.opLog.record(user.id, 'backup_restore', 'database', { filename });
    return result;
  }
}
