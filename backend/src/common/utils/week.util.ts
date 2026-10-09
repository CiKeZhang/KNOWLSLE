import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeeksInYear from 'dayjs/plugin/isoWeeksInYear';
import weekday from 'dayjs/plugin/weekday';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeeksInYear);
dayjs.extend(weekday);

export { dayjs };

/**
 * 周度打卡工具:以自然周(周一 00:00 - 周日 23:59:59)为一个打卡周期。
 */
export class WeekUtil {
  /** 给定时间所在自然周的周一 00:00 */
  static weekStart(date: Date | string = new Date()): Date {
    const d = dayjs(date);
    // ISO week: 周一为 1, 周日为 7
    const weekdayIdx = d.isoWeekday(); // 1..7
    return d.subtract(weekdayIdx - 1, 'day').startOf('day').toDate();
  }

  /** 给定时间所在自然周的周日 23:59:59 */
  static weekEnd(date: Date | string = new Date()): Date {
    const start = this.weekStart(date);
    return dayjs(start).add(6, 'day').endOf('day').toDate();
  }

  /** 上周区间 */
  static lastWeekStart(date: Date | string = new Date()): Date {
    return dayjs(this.weekStart(date)).subtract(7, 'day').toDate();
  }

  /** YYYY-Www 形式的周次键 */
  static weekKey(date: Date | string = new Date()): string {
    const d = dayjs(date);
    const year = d.isoWeekYear();
    const week = d.isoWeek();
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /** YYYY-MM */
  static monthKey(date: Date | string = new Date()): string {
    return dayjs(date).format('YYYY-MM');
  }

  /** 是否在当前周的截止时间内 */
  static isWithinCheckInWindow(rule: { startAt: string; endAt: string }, now = new Date()): boolean {
    const n = dayjs(now);
    const ws = this.weekStart(now);
    const we = this.weekEnd(now);
    const [sh, sm] = rule.startAt.split(':').map(Number);
    const [eh, em] = rule.endAt.split(':').map(Number);
    const startAt = dayjs(ws).hour(sh).minute(sm).second(0);
    const endAt = dayjs(we).hour(eh).minute(em).second(59);
    return n.isAfter(startAt) && n.isBefore(endAt);
  }

  /** 是否已超过本周截止时间 */
  static isPastDeadline(rule: { endAt: string }, now = new Date()): boolean {
    const we = this.weekEnd(now);
    const [eh, em] = rule.endAt.split(':').map(Number);
    return dayjs(now).isAfter(dayjs(we).hour(eh).minute(em).second(59));
  }
}
