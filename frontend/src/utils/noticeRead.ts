/**
 * 消息已读状态(纯前端本地方案)
 *
 * 后端 notification_log 表没有已读字段,加字段需改数据库并重新部署,
 * 测试期风险高。这里用 localStorage 按用户隔离地记录已读消息 ID,
 * 通过自定义事件通知布局刷新铃铛角标。换账号/换浏览器互不影响。
 */
const KEY_PREFIX = 'kygl_read_notices_';
const CHANGE_EVENT = 'kygl:notice-read-changed';

function keyFor(userId: string | number): string {
  return `${KEY_PREFIX}${userId}`;
}

function readIds(userId: string | number): number[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function writeIds(userId: string | number, ids: number[]): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* 存储不可用(隐私模式等)时静默降级 */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** 某条消息是否已读 */
export function isNoticeRead(userId: string | number, noticeId: number): boolean {
  return readIds(userId).includes(Number(noticeId));
}

/** 标记一条消息已读 */
export function markNoticeRead(userId: string | number, noticeId: number): void {
  const ids = readIds(userId);
  if (!ids.includes(Number(noticeId))) {
    writeIds(userId, [...ids, Number(noticeId)]);
  }
}

/** 批量标记已读(全部已读) */
export function markAllNoticesRead(userId: string | number, noticeIds: number[]): void {
  const ids = readIds(userId);
  const merged = Array.from(new Set([...ids, ...noticeIds.map(Number)]));
  writeIds(userId, merged);
}

/** 计算未读数:总数 - 已读且仍在收件箱内的数量 */
export function unreadCountOf(userId: string | number, allNoticeIds: number[]): number {
  const read = new Set(readIds(userId));
  return allNoticeIds.filter((id) => !read.has(Number(id))).length;
}

/** 订阅已读变化(布局/消息页刷新用),返回取消订阅函数 */
export function onNoticeReadChanged(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
