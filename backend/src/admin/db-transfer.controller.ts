import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DbTransferGuard } from '../common/guards/db-transfer.guard';
import {
  BackupService,
  SNAPSHOT_FORMAT,
} from '../common/services/backup.service';

export class ImportDbDto {
  @IsString()
  @IsNotEmpty()
  /** 与 GET /api/admin/db/export 返回的 base64 完全一致 */
  base64: string;

  @IsString()
  @IsIn(['RESTORE'])
  /** 防误操作的显式确认 */
  confirm: string;

  @IsOptional()
  @IsBoolean()
  /** 只校验不写盘,用于升级前先试跑 */
  dryRun?: boolean;
}

/**
 * 数据库导出 / 回灌(运维专用)。
 *
 * 云托管容器默认无持久卷时的标准升级流程:
 *   1. 升级前 GET  /api/admin/db/export    → 保存 base64 快照
 *   2. 部署新版本(容器重建,数据回到镜像 seed)
 *   3. 升级后 POST /api/admin/db/import    → 回灌快照,无需重新打包镜像
 *
 * 鉴权:系统管理员 Bearer Token,或请求头 x-db-transfer-secret(需显式配置
 * 环境变量 DB_TRANSFER_SECRET)。不再有硬编码默认口令。
 */
@ApiTags('数据库传输(运维)')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-db-transfer-secret',
  description: '可选运维通道口令(环境变量 DB_TRANSFER_SECRET);不传则走管理员 JWT',
  required: false,
})
@UseGuards(DbTransferGuard)
@Controller('admin/db')
export class DbTransferController {
  constructor(private readonly backup: BackupService) {}

  @Get('status')
  @ApiOperation({ summary: '查看数据库位置、体积、备份数量与是否挂载持久卷' })
  status() {
    return this.backup.status();
  }

  @Get('export')
  @ApiOperation({
    summary: '导出数据库一致性快照(gzip+base64,格式与控制台 WebShell 导出命令一致)',
  })
  async exportDb(@Res({ passthrough: true }) res: any) {
    res.setHeader('Cache-Control', 'no-store');
    return this.backup.buildPayload();
  }

  @Get('export.txt')
  @ApiOperation({ summary: '导出为可直接存记事本的 ===START=== / ===END=== 纯文本' })
  async exportText(@Res() res: any) {
    const payload = await this.backup.buildPayload();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`===START===\n${payload.base64}\n===END===\n`);
  }

  @Post('import')
  @ApiOperation({
    summary: '回灌数据库快照(需 confirm:"RESTORE";支持 dryRun 只校验)',
  })
  async importDb(@Body() dto: ImportDbDto) {
    const parsed = this.backup.parsePayload(dto.base64);
    if (dto.dryRun) {
      return {
        ok: true,
        dryRun: true,
        format: SNAPSHOT_FORMAT,
        bytes: parsed.main.length,
        sha256: parsed.sha256,
        message: '校验通过,未写盘',
      };
    }
    return {
      format: SNAPSHOT_FORMAT,
      ...(await this.backup.applySnapshot(parsed.main, parsed.extras, parsed.sha256)),
    };
  }
}
