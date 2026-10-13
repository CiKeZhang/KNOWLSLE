// 考研阶段标签工具
import type { ETagProps } from 'element-plus';

export const STAGE_LIST = [
  { value: 'NOT_STARTED', label: '未开始备考' },
  { value: 'CHOOSING', label: '择校阶段' },
  { value: 'BASIC', label: '基础复习阶段' },
  { value: 'STRENGTHENING', label: '强化刷题阶段' },
  { value: 'SPRINT', label: '冲刺阶段' },
  { value: 'EXAM_DONE', label: '初试结束待成绩' },
  { value: 'REEXAM_PREP', label: '初试通过备战复试' },
  { value: 'ADJUSTING', label: '调剂中' },
  { value: 'FINISHED', label: '考研结束' },
];

const STAGE_MAP = Object.fromEntries(STAGE_LIST.map((s) => [s.value, s.label]));

export function stageLabel(stage?: string): string {
  if (!stage) return '未开始';
  return STAGE_MAP[stage] ?? stage;
}

export function stageTagType(stage?: string): ETagProps['type'] {
  const m: Record<string, ETagProps['type']> = {
    NOT_STARTED: 'info',
    CHOOSING: 'warning',
    BASIC: '',
    STRENGTHENING: 'success',
    SPRINT: 'danger',
    EXAM_DONE: 'info',
    REEXAM_PREP: 'warning',
    ADJUSTING: 'danger',
    FINISHED: 'success',
  };
  return m[stage || 'NOT_STARTED'] ?? 'info';
}

// 院校层次
export const SCHOOL_TIER_LIST = [
  { value: 'NINE_EIGHT_FIVE', label: '985' },
  { value: 'TWO_ONE_ONE', label: '211' },
  { value: 'DOUBLE_FIRST', label: '双一流' },
  { value: 'DOUBLE_NON', label: '双非' },
];

export function tierLabel(tier?: string): string {
  return SCHOOL_TIER_LIST.find((t) => t.value === tier)?.label ?? '双非';
}

// 帮扶类型
export const HELP_TYPE_LIST = [
  { value: 'SCHOOL_CHOICE', label: '择校困惑' },
  { value: 'SUBJECT_BOTTLENECK', label: '单科瓶颈' },
  { value: 'MENTAL_STATE', label: '心态问题' },
  { value: 'REEXAM_GUIDE', label: '复试指导' },
  { value: 'OTHER', label: '其他' },
];

export function helpTypeLabel(type?: string): string {
  return HELP_TYPE_LIST.find((t) => t.value === type)?.label ?? type ?? '';
}

// 资源类型
export const RESOURCE_TYPE_LIST = [
  { value: 'PUBLIC_COURSE', label: '公共课资料' },
  { value: 'PROFESSIONAL', label: '专业课真题' },
  { value: 'EXPERIENCE', label: '学长学姐经验贴' },
  { value: 'REFERENCE_BOOK', label: '参考书目' },
  { value: 'ONLINE_COURSE', label: '网课' },
];

export function resourceTypeLabel(type?: string): string {
  return RESOURCE_TYPE_LIST.find((t) => t.value === type)?.label ?? type ?? '';
}

// 预警类型标签
export const ALERT_TYPE_MAP: Record<string, string> = {
  CHECKIN_MISSING: '当周逾期未打卡',
  CHECKIN_CONSECUTIVE: '连续2周未打卡',
  PROGRESS_STALE: '连续3周进度无更新',
  PROGRESS_LAGGING: '进度滞后于平均',
  SCORE_BELOW_LINE: '初试未达国家线',
  ADJUSTMENT_STUCK: '调剂无进展',
  LOGIN_INACTIVE: '连续15天未登录',
};

export function alertTypeLabel(type?: string): string {
  return ALERT_TYPE_MAP[type || ''] ?? type ?? '';
}

// 打卡状态标签
export const CHECKIN_STATUS_MAP: Record<string, { label: string; type: ETagProps['type'] }> = {
  ON_TIME: { label: '按时完成', type: 'success' },
  LATE: { label: '逾期后补', type: 'warning' },
  MISSING: { label: '未打卡', type: 'danger' },
};

export function checkinStatusLabel(status?: string): string {
  return CHECKIN_STATUS_MAP[status || '']?.label ?? status ?? '';
}

export function checkinStatusTagType(status?: string): ETagProps['type'] {
  return CHECKIN_STATUS_MAP[status || '']?.type ?? 'info';
}
