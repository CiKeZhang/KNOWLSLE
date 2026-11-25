/**
 * 表单本地草稿(纯前端)
 *
 * 自动把 reactive 表单持久化到 localStorage(按用户+表单名隔离),
 * 防止手机上填一半被刷新/切走而丢失。提交成功后调用 clear() 清除。
 */
import { watch, type Reactive } from 'vue';

const KEY_PREFIX = 'kygl_form_draft_';

function keyFor(userId: string | number, name: string): string {
  return `${KEY_PREFIX}${userId}_${name}`;
}

export interface DraftHandle {
  /** 是否有草稿并已恢复到表单 */
  restored: boolean;
  /** 手动恢复草稿(用于 load 后端数据之后再恢复,草稿优先) */
  restore: () => boolean;
  /** 提交成功后清除草稿 */
  clear: () => void;
}

/**
 * @param userId 当前用户 ID(用于多账号隔离)
 * @param name 表单标识(如 'checkin' / 'archive')
 * @param form reactive 表单对象
 * @param autoRestore 是否立即恢复(默认 true)。若页面 load() 会用后端数据覆盖表单,
 *                    传 false 并在 load 之后手动调用 restore()
 */
export function useFormDraft(
  userId: string | number | undefined,
  name: string,
  form: Reactive<Record<string, any>>,
  autoRestore = true,
): DraftHandle {
  const key = userId ? keyFor(userId, name) : '';
  const handle: DraftHandle = {
    restored: false,
    restore: () => false,
    clear: () => {
      if (key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
      handle.restored = false;
    },
  };

  handle.restore = () => {
    if (!key || handle.restored) return handle.restored;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && saved.__savedAt) {
          Object.assign(form, saved.data || {});
          handle.restored = true;
          return true;
        }
      }
    } catch {
      /* 草稿损坏则忽略 */
    }
    return false;
  };

  if (key) {
    if (autoRestore) handle.restore();
    // 深度监听:任何字段变化都自动保存(带时间戳,避免空对象被误判为草稿)
    watch(
      form,
      (val) => {
        try {
          localStorage.setItem(key, JSON.stringify({ __savedAt: Date.now(), data: val }));
        } catch {
          /* 存储不可用静默降级 */
        }
      },
      { deep: true },
    );
  }

  return handle;
}
