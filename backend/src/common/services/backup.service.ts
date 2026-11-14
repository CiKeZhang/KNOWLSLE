import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import dayjs from 'dayjs';

/** SQLite 文件头前 16 字节 */
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'utf8');
/** 允许导入的最大数据库体积,防止超大 body 打爆内存 */
const MAX_DB_BYTES = 32 * 1024 * 1024;
const BACKUP_PREFIX = 'kygl_backup_';
const BACKUP_SUFFIX = '.db.gz';
const BACKUP_NAME_RE = /^kygl_backup_\d{8}_\d{6}\.db\.gz$/;
const SIDECARS = ['-wal', '-shm', '-journal'];
/** 与控制台 WebShell 里那段导出命令完全一致的载荷格式 */
export const SNAPSHOT_FORMAT = 'kygl-db-v2';

export interface BackupMeta {
  filename: string;
  size: number;
  dbSize: number;
  sha256: string;
  createdAt: string;
}

export interface SnapshotPayload {
  format: string;
  filename: string;
  bytes: number;
  sha256: string;
  files: string[];
  exportedAt: string;
  base64: string;
}

export interface ParsedSnapshot {
  main: Buffer;
  extras: Record<string, Buffer>;
  sha256: string;
}

/**
 * SQLite 数据库备份 / 快照 / 恢复服务。
 *
 * 背景:云托管容器默认没有持久卷,/app/data 属于容器可写层,
 * 部署、重启、扩缩容都会清空。因此:
 *  1. 定时把库快照写到 BACKUP_DIR(默认与 db 同目录的 backups/),
 *     一旦把 /app/data 挂到 CFS/COS 持久卷,备份就自动变成持久化的;
 *  2. 提供与控制台 WebShell 导出命令同格式的快照载荷,用于升级前导出;
 *  3. 提供导入能力,升级后可直接回灌,不必再把 db 塞进镜像重新打包。
 *
 * 只依赖 Node 内置模块,不引入 sqlite3 / better-sqlite3 等新依赖。
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly dbPath: string;
  private readonly backupDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const raw = (this.config.get<string>('DATABASE_URL') || 'file:/app/data/kygl.db').replace(
      /^file:/,
      '',
    );
    this.dbPath = path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), 'prisma', raw.replace(/^\.\//, ''));
    this.backupDir =
      this.config.get<string>('BACKUP_DIR') || path.join(path.dirname(this.dbPath), 'backups');
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getBackupDir(): string {
    return this.backupDir;
  }

  private ensureDirs(): void {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  /** 尽力把 WAL 合并进主库文件;delete 模式下会直接失败,忽略即可 */
  private async checkpoint(): Promise<void> {
    try {
      await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      // SQLite 处于 delete 模式或 Prisma 不支持该 PRAGMA,快照仍会带上 sidecar 文件
    }
  }

  static assertSqlite(buf: Buffer, label = '数据库'): void {
    if (!Buffer.isBuffer(buf) || buf.length < 100) {
      throw new BadRequestException(`${label}文件过小或格式不正确`);
    }
    if (buf.length > MAX_DB_BYTES) {
      throw new BadRequestException(`${label}超过 ${MAX_DB_BYTES / 1024 / 1024}MB 上限`);
    }
    if (!buf.subarray(0, 16).equals(SQLITE_MAGIC)) {
      throw new BadRequestException(`${label}不是合法的 SQLite 文件(文件头校验失败)`);
    }
  }

  static sha256(buf: Buffer): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  /** 读取主库以及 -wal / -shm / -journal,key 用文件名,与 WebShell 命令一致 */
  private collectFiles(): Record<string, string> {
    this.ensureDirs();
    if (!fs.existsSync(this.dbPath)) {
      throw new NotFoundException(`数据库文件不存在: ${this.dbPath}`);
    }
    const out: Record<string, string> = {};
    const base = path.basename(this.dbPath);
    out[base] = fs.readFileSync(this.dbPath).toString('base64');
    for (const suffix of SIDECARS) {
      const p = `${this.dbPath}${suffix}`;
      if (fs.existsSync(p)) {
        out[`${base}${suffix}`] = fs.readFileSync(p).toString('base64');
      }
    }
    return out;
  }

  /** 生成可直接贴进记事本 / 传给导入接口的快照载荷 */
  async buildPayload(): Promise<SnapshotPayload> {
    await this.checkpoint();
    const files = this.collectFiles();
    const mainKey = Object.keys(files).find((k) => !SIDECARS.some((s) => k.endsWith(s)))!;
    const main = Buffer.from(files[mainKey], 'base64');
    BackupService.assertSqlite(main, '快照');
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(files)), { level: 9 }).toString('base64');
    return {
      format: SNAPSHOT_FORMAT,
      filename: 'kygl.db.gz',
      bytes: body.length,
      sha256: BackupService.sha256(main),
      files: Object.keys(files),
      exportedAt: new Date().toISOString(),
      base64: body,
    };
  }

  /**
   * 解析快照载荷。同时兼容两种输入:
   *  - kygl-db-v2: gzip(JSON({ "kygl.db": base64, "kygl.db-wal": base64, ... }))
   *  - 旧版导出:   gzip(原始 SQLite 文件)
   */
  parsePayload(base64: string): ParsedSnapshot {
    if (typeof base64 !== 'string' || base64.length < 40) {
      throw new BadRequestException('base64 内容为空或不完整');
    }
    if (base64.length > MAX_DB_BYTES * 1.5) {
      throw new BadRequestException('载荷过大,已拒绝');
    }
    let raw: Buffer;
    try {
      raw = zlib.gunzipSync(Buffer.from(base64.replace(/\s/g, ''), 'base64'));
    } catch {
      throw new BadRequestException('载荷无法解压,请确认复制完整且未被换行/截断破坏');
    }

    let files: Record<string, string> | null = null;
    try {
      const parsed = JSON.parse(raw.toString('utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const mainKey = Object.keys(parsed).find(
          (k) => typeof parsed[k] === 'string' && !SIDECARS.some((s) => k.endsWith(s)),
        );
        if (mainKey) files = parsed as Record<string, string>;
      }
    } catch {
      // 不是 JSON,按旧版的「gzip(原始 db)」处理
    }

    const extras: Record<string, Buffer> = {};
    let main: Buffer;
    if (files) {
      const mainKey = Object.keys(files).find((k) => !SIDECARS.some((s) => k.endsWith(s)))!;
      main = Buffer.from(files[mainKey], 'base64');
      for (const [name, value] of Object.entries(files)) {
        if (name === mainKey || typeof value !== 'string') continue;
        // 只接受已知 sidecar,防止任意文件写入
        const suffix = SIDECARS.find((s) => name.endsWith(s));
        if (!suffix) continue;
        const buf = Buffer.from(value, 'base64');
        if (buf.length > MAX_DB_BYTES) continue;
        extras[suffix] = buf;
      }
    } else {
      main = raw;
    }

    BackupService.assertSqlite(main, '待恢复数据库');
    return { main, extras, sha256: BackupService.sha256(main) };
  }

  /** 落盘一份 gz 快照,供定时备份 / 恢复前留底 */
  async createBackup(): Promise<BackupMeta> {
    await this.checkpoint();
    this.ensureDirs();
    const db = fs.readFileSync(this.dbPath);
    BackupService.assertSqlite(db, '当前数据库');
    const filename = `${BACKUP_PREFIX}${dayjs().format('YYYYMMDD_HHmmss')}${BACKUP_SUFFIX}`;
    const filepath = path.join(this.backupDir, filename);
    fs.writeFileSync(filepath, zlib.gzipSync(db, { level: 9 }));
    const meta: BackupMeta = {
      filename,
      size: fs.statSync(filepath).size,
      dbSize: db.length,
      sha256: BackupService.sha256(db),
      createdAt: new Date().toISOString(),
    };
    this.logger.log(`数据库备份完成: ${filename} (${(meta.size / 1024).toFixed(1)} KB)`);
    this.cleanOldBackups();
    return meta;
  }

  async listBackups(): Promise<BackupMeta[]> {
    this.ensureDirs();
    const items: BackupMeta[] = [];
    for (const name of fs.readdirSync(this.backupDir)) {
      if (!BACKUP_NAME_RE.test(name)) continue;
      const p = path.join(this.backupDir, name);
      const stat = fs.statSync(p);
      if (!stat.isFile()) continue;
      let dbSize = 0;
      let sha256 = '';
      try {
        const db = zlib.gunzipSync(fs.readFileSync(p));
        dbSize = db.length;
        sha256 = BackupService.sha256(db);
      } catch {
        // 损坏的备份仍然列出,但不提供体积/摘要
      }
      items.push({
        filename: name,
        size: stat.size,
        dbSize,
        sha256,
        createdAt: stat.mtime.toISOString(),
      });
    }
    return items.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  /**
   * 原子替换正在使用的数据库。
   * 先断开 Prisma 连接 → 同目录 rename 覆盖 → 清理旧 journal → 重新连接,
   * 整个过程无需重启容器,也不需要额外依赖。
   */
  async applySnapshot(
    main: Buffer,
    extras: Record<string, Buffer> = {},
    sha256 = BackupService.sha256(main),
  ): Promise<{ ok: boolean; restoredBytes: number; sha256: string; previousBackup: string | null }> {
    BackupService.assertSqlite(main, '待恢复数据库');
    this.ensureDirs();

    let previousBackup: string | null = null;
    if (fs.existsSync(this.dbPath)) {
      try {
        previousBackup = (await this.createBackup()).filename;
      } catch (e) {
        this.logger.warn(`恢复前留底失败,继续恢复: ${e?.message ?? e}`);
      }
    }

    const tmp = `${this.dbPath}.restoring`;
    await this.prisma.$disconnect();
    try {
      // 同目录 rename,Linux 下为原子覆盖
      fs.writeFileSync(tmp, main);
      fs.renameSync(tmp, this.dbPath);
      // 旧库的 journal/WAL 若留着,SQLite 打开新库时可能回放旧日志导致损坏
      for (const suffix of SIDECARS) {
        fs.rmSync(`${this.dbPath}${suffix}`, { force: true });
      }
      for (const [suffix, buf] of Object.entries(extras)) {
        fs.writeFileSync(`${this.dbPath}${suffix}`, buf);
      }
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      throw new BadRequestException(`写入数据库失败: ${e?.message ?? e}`);
    } finally {
      try {
        await this.prisma.$connect();
      } catch (e) {
        this.logger.error(`恢复后重连数据库失败: ${e?.message ?? e}`);
      }
    }

    this.logger.warn(`数据库已恢复: ${main.length} bytes, sha256=${sha256}`);
    return { ok: true, restoredBytes: main.length, sha256, previousBackup };
  }

  async restoreBackup(filename: string) {
    if (!BACKUP_NAME_RE.test(filename)) {
      throw new BadRequestException('非法的备份文件名');
    }
    const p = path.join(this.backupDir, filename);
    if (!fs.existsSync(p)) {
      throw new NotFoundException('备份文件不存在');
    }
    let db: Buffer;
    try {
      db = zlib.gunzipSync(fs.readFileSync(p));
    } catch {
      throw new BadRequestException('备份文件已损坏,无法解压');
    }
    return this.applySnapshot(db);
  }

  async status() {
    this.ensureDirs();
    const exists = fs.existsSync(this.dbPath);
    const size = exists ? fs.statSync(this.dbPath).size : 0;
    const backups = await this.listBackups();
    let journalMode = 'unknown';
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe('PRAGMA journal_mode');
      journalMode = rows?.[0]?.journal_mode ?? 'unknown';
    } catch {
      // 忽略
    }
    // 通过 /proc/mounts 判断数据目录是否为独立挂载(即是否持久化)
    let persistentVolume = false;
    try {
      const dataDir = path.dirname(this.dbPath);
      persistentVolume = fs
        .readFileSync('/proc/mounts', 'utf8')
        .split('\n')
        .some((line) => {
          const parts = line.split(' ');
          return parts[1] === dataDir && !parts[2]?.startsWith('overlay');
        });
    } catch {
      // 非 Linux 环境,忽略
    }
    return {
      dbPath: this.dbPath,
      dbExists: exists,
      dbSize: size,
      journalMode,
      backupDir: this.backupDir,
      backupCount: backups.length,
      latestBackup: backups[0] ?? null,
      persistentVolume,
      hint: persistentVolume
        ? '数据目录已挂载持久卷,部署不会清空数据。'
        : '数据目录位于容器可写层,重建/扩容会清空;请挂载 CFS/COS 到 /app/data,或在每次升级前调用导出接口留底。',
    };
  }

  /** 每日 02:00 自动快照 */
  @Cron('0 0 2 * * *')
  async scheduledBackup() {
    try {
      await this.createBackup();
    } catch (e) {
      this.logger.error(`定时备份失败: ${e?.message ?? e}`);
    }
  }

  /** 保留最近 30 天且最多 60 份 */
  private cleanOldBackups(): void {
    try {
      const cutoff = dayjs().subtract(30, 'day').valueOf();
      const names = fs
        .readdirSync(this.backupDir)
        .filter((n) => BACKUP_NAME_RE.test(n))
        .sort()
        .reverse();
      names.forEach((name, index) => {
        const p = path.join(this.backupDir, name);
        const mtime = fs.statSync(p).mtimeMs;
        if (mtime < cutoff || index >= 60) {
          fs.rmSync(p, { force: true });
        }
      });
    } catch (e) {
      this.logger.warn(`清理过期备份失败: ${e?.message ?? e}`);
    }
  }
}
