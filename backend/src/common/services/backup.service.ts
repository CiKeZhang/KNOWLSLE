import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';

const execAsync = promisify(exec);

/**
 * 数据库自动备份与恢复服务
 * - 每日凌晨 2:00 自动备份 mysqldump -> BACKUP_DIR
 * - 保留最近 30 天备份,自动清理过期文件
 * - 提供手动触发备份与一键恢复接口(仅系统管理员)
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  /** 每日凌晨 2:00 自动备份 */
  @Cron('0 0 2 * * *')
  async scheduledBackup() {
    await this.createBackup();
    await this.cleanOldBackups();
  }

  /** 手动触发备份,返回文件名 */
  async createBackup(): Promise<{ filename: string; size: number }> {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    const backupDir = this.config.get<string>('BACKUP_DIR', '/app/backups');
    const { host, port, user, password, database } = this.parseDbUrl(dbUrl);

    const filename = `kygl_backup_${dayjs().format('YYYYMMDD_HHmmss')}.sql.gz`;
    const filepath = join(backupDir, filename);

    // 使用 mysqldump 并通过 gzip 压缩
    const cmd = `mysqldump -h${host} -P${port} -u${user} -p'${password}' ${database} --single-transaction --routines --triggers --set-gtid-purged=OFF 2>/dev/null | gzip > ${filepath}`;

    try {
      await execAsync(cmd, { timeout: 300000 }); // 5 分钟超时
      const s = await stat(filepath);
      this.logger.log(`数据库备份完成: ${filename} (${(s.size / 1024).toFixed(1)} KB)`);
      await this.cleanOldBackups();
      return { filename, size: s.size };
    } catch (e) {
      this.logger.error(`数据库备份失败: ${e?.message ?? ''}`);
      throw new Error(`数据库备份失败: ${e?.message ?? ''}`);
    }
  }

  /** 一键恢复:从指定备份文件恢复数据库 */
  async restoreBackup(filename: string): Promise<{ ok: boolean }> {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    const backupDir = this.config.get<string>('BACKUP_DIR', '/app/backups');
    const { host, port, user, password, database } = this.parseDbUrl(dbUrl);
    const filepath = join(backupDir, filename);

    // 安全校验:文件名只允许 kygl_backup_*.sql.gz
    if (!/^kygl_backup_\d{8}_\d{6}\.sql\.gz$/.test(filename)) {
      throw new Error('非法的备份文件名');
    }

    try {
      await stat(filepath);
    } catch {
      throw new Error('备份文件不存在');
    }

    const cmd = `gunzip < ${filepath} | mysql -h${host} -P${port} -u${user} -p'${password}' ${database} 2>/dev/null`;
    try {
      await execAsync(cmd, { timeout: 600000 }); // 10 分钟超时
      this.logger.log(`数据库恢复完成: ${filename}`);
      return { ok: true };
    } catch (e) {
      this.logger.error(`数据库恢复失败: ${e?.message ?? ''}`);
      throw new Error(`数据库恢复失败: ${e?.message ?? ''}`);
    }
  }

  /** 列出所有备份文件 */
  async listBackups(): Promise<{ filename: string; size: number; createdAt: string }[]> {
    const backupDir = this.config.get<string>('BACKUP_DIR', '/app/backups');
    try {
      const files = await readdir(backupDir);
      const backups: { filename: string; size: number; createdAt: string }[] = [];
      for (const f of files) {
        if (!f.startsWith('kygl_backup_') || !f.endsWith('.sql.gz')) continue;
        const filepath = join(backupDir, f);
        const s = await stat(filepath);
        backups.push({
          filename: f,
          size: s.size,
          createdAt: s.mtime.toISOString(),
        });
      }
      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  /** 自动清理 30 天前的备份 */
  private async cleanOldBackups() {
    const backupDir = this.config.get<string>('BACKUP_DIR', '/app/backups');
    const retentionDays = 30;
    const cutoff = dayjs().subtract(retentionDays, 'day');
    try {
      const files = await readdir(backupDir);
      for (const f of files) {
        if (!f.startsWith('kygl_backup_') || !f.endsWith('.sql.gz')) continue;
        const filepath = join(backupDir, f);
        const s = await stat(filepath);
        if (dayjs(s.mtime).isBefore(cutoff)) {
          await unlink(filepath);
          this.logger.log(`已清理过期备份: ${f}`);
        }
      }
    } catch (e) {
      this.logger.warn(`清理过期备份时出错: ${e?.message ?? ''}`);
    }
  }

  private parseDbUrl(url: string): { host: string; port: number; user: string; password: string; database: string } {
    // mysql://user:pass@host:port/db?...
    const m = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/.exec(url);
    if (!m) throw new Error('DATABASE_URL 格式不合法');
    return {
      user: m[1],
      password: decodeURIComponent(m[2]),
      host: m[3],
      port: parseInt(m[4], 10),
      database: m[5],
    };
  }
}
