#!/usr/bin/env node
'use strict';
/**
 * 容器启动前的 SQLite 数据库准备脚本(纯 Node 内置模块,无额外依赖)。
 *
 * 云托管容器默认没有持久卷,/app/data 属容器可写层,部署/重启/扩容都会清空。
 * 这里按优先级把库恢复到 DB_PATH:
 *   1. DB_PATH 已存在且合法  → 直接沿用(挂了持久卷时走这条)
 *   2. pending-restore.db    → 运维手动放进去的待恢复库
 *   3. BACKUP_DIR 最新快照   → 由 BackupService 定时/手动生成
 *   4. /app/prisma/dev.db    → 镜像内置 seed(当前部署包里的真实数据)
 *   5. 都没有                → exit 2,交给 entrypoint 跑 prisma db push 建空表
 *
 * 退出码: 0=已就绪  2=需要建空表  1=异常
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
const SEED_DB = process.env.SEED_DB || '/app/prisma/dev.db';
const MAGIC = Buffer.from('SQLite format 3\0', 'utf8');
const SIDECARS = ['-wal', '-shm', '-journal'];

function resolveDbPath() {
  const url = process.env.DATABASE_URL || 'file:/app/data/kygl.db';
  let raw = url.replace(/^file:/, '');
  return path.isAbsolute(raw) ? raw : path.join(DATA_DIR, raw);
}

const DB_PATH = resolveDbPath();

function isSqlite(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 100 && buf.subarray(0, 16).equals(MAGIC);
}

function readSqlite(file) {
  try {
    const buf = fs.readFileSync(file);
    return isSqlite(buf) ? buf : null;
  } catch {
    return null;
  }
}

function cleanSidecars(target) {
  for (const suffix of SIDECARS) {
    try {
      fs.unlinkSync(target + suffix);
    } catch {
      /* 不存在则忽略 */
    }
  }
}

function install(buf, label) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  cleanSidecars(DB_PATH);
  const tmp = `${DB_PATH}.preparing`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, DB_PATH); // 同目录原子覆盖
  console.log(`[prepare-db] ${label} → ${DB_PATH} (${(buf.length / 1024).toFixed(1)} KB)`);
}

function latestBackup() {
  let names = [];
  try {
    names = fs
      .readdirSync(BACKUP_DIR)
      .filter((n) => /^kygl_backup_\d{8}_\d{6}\.db\.gz$/.test(n))
      .sort()
      .reverse();
  } catch {
    return null;
  }
  for (const name of names) {
    try {
      const buf = zlib.gunzipSync(fs.readFileSync(path.join(BACKUP_DIR, name)));
      if (isSqlite(buf)) {
        console.log(`[prepare-db] 选用备份 ${name}`);
        return buf;
      }
      console.warn(`[prepare-db] 备份 ${name} 内容不是合法 SQLite,跳过`);
    } catch (e) {
      console.warn(`[prepare-db] 备份 ${name} 解压失败: ${e.message}`);
    }
  }
  return null;
}

function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
  console.log(`[prepare-db] DB_PATH=${DB_PATH}`);
  console.log(`[prepare-db] BACKUP_DIR=${BACKUP_DIR}`);

  // 1. 已有数据库
  if (fs.existsSync(DB_PATH)) {
    if (readSqlite(DB_PATH)) {
      const size = fs.statSync(DB_PATH).size / 1024;
      console.log(`[prepare-db] 数据库已存在且校验通过 (${size.toFixed(1)} KB),沿用现有数据`);
      process.exit(0);
    }
    const backupName = `${DB_PATH}.corrupt-${Date.now()}`;
    fs.renameSync(DB_PATH, backupName);
    console.warn(`[prepare-db] 检测到损坏/非 SQLite 文件,已另存为 ${backupName},继续尝试恢复`);
  }

  // 2. 待恢复文件
  const pending = path.join(DATA_DIR, 'pending-restore.db');
  const pendingBuf = readSqlite(pending);
  if (pendingBuf) {
    install(pendingBuf, '从 pending-restore.db 恢复');
    try {
      fs.unlinkSync(pending);
    } catch {
      /* ignore */
    }
    process.exit(0);
  }

  // 3. 最新备份
  const backupBuf = latestBackup();
  if (backupBuf) {
    install(backupBuf, '从最新备份恢复');
    process.exit(0);
  }

  // 4. 镜像内置 seed
  const seed = readSqlite(SEED_DB);
  if (seed) {
    install(seed, '从镜像内置 seed 初始化');
    process.exit(0);
  }

  // 5. 建空表
  console.warn('[prepare-db] 未找到任何可用数据文件,将执行 prisma db push 建立空表');
  process.exit(2);
}

try {
  main();
} catch (e) {
  console.error(`[prepare-db] 数据库准备异常: ${e.stack || e.message}`);
  process.exit(1);
}
