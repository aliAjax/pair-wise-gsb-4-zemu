// 领域数据：时间桶工具。所有“每日 N 次 / 次日复习”的规则都按本地日期键（YYYY-MM-DD）归桶。

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** aKey 相对 bKey 相差几天（aKey 晚为正）。 */
export function diffDays(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  const ms = new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  return Math.round(ms / 86_400_000);
}

export function dueLabel(dueKey: string, today: string): string {
  const d = diffDays(dueKey, today);
  if (d === 0) return '今天到期';
  if (d === 1) return '明天到期';
  if (d > 1) return `${d} 天后到期`;
  return `逾期 ${-d} 天`;
}

export function fmtDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日 · 周${WEEK[new Date(y, m - 1, d).getDay()]}`;
}

export function fmtClock(iso: string, today: string): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const key = dayKey(d);
  if (key === today) return `今天 ${hm}`;
  if (key === addDaysKey(today, -1)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}
