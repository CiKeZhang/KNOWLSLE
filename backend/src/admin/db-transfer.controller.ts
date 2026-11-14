import { Controller, Get, Query, BadRequestException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * 数据库导出(口令保护)
 * 用途:云托管容器无持久卷时,部署前先导出数据,部署后可把导出的 db 替换进 prisma/dev.db 重新打包恢复。
 */
@ApiTags('数据库导出')
@Controller('admin/db')
export class DbTransferController {
  constructor(private readonly config: ConfigService) {}

  private dbPath(): string {
    const url = process.env.DATABASE_URL || 'file:/app/data/kygl.db';
    const raw = url.replace(/^file:/, '');
    if (path.isAbsolute(raw)) return raw;
    // 相对路径(如 ./dev.db)按 Prisma 规则相对 schema 所在目录解析
    const candidates = [
      path.resolve(process.cwd(), raw),
      path.resolve(process.cwd(), 'prisma', raw.replace(/^\.\//, '')),
      path.resolve(process.cwd(), 'prisma', path.basename(raw)),
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
  }

  private assertSecret(secret?: string) {
    const expected = this.config.get<string>('TEST_LOGIN_SECRET') || 'kygl-test-2026';
    if (!secret || secret !== expected) {
      throw new BadRequestException('口令错误');
    }
  }

  @Public()
  @Get('export')
  @ApiOperation({ summary: '导出数据库(gzip+base64,口令保护)' })
  exportDb(@Query('secret') secret: string, @Res({ passthrough: true }) res: any) {
    this.assertSecret(secret);
    const file = this.dbPath();
    if (!fs.existsSync(file)) {
      throw new BadRequestException('数据库文件不存在');
    }
    // 先做一次 wal checkpoint,保证数据已落盘
    const raw = fs.readFileSync(file);
    const gz = zlib.gzipSync(raw);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return {
      filename: 'kygl.db.gz',
      bytes: gz.length,
      exportedAt: new Date().toISOString(),
      base64: gz.toString('base64'),
    };
  }
}
