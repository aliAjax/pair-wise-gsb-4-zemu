// 纯工具：本地日期与 ID（无副作用、可测试）

export function uid(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

/** 当地时区的 YYYY-MM-DD（「每天」按本地日历切分） */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}

/** 秒 -> m:ss / h:mm:ss */
export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

export function fmtHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function fullDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${m}月${d}日 周${WEEK[new Date(y, m - 1, d).getDay()]}`;
}

/** 到期相对标签 */
export function dueLabel(dueKey: string, today: string): string {
  if (dueKey === today) return '今天到期';
  if (dueKey < today) {
    const n = diffDays(today, dueKey);
    return n <= 1 ? '已逾期' : `逾期 ${n} 天`;
  }
  const n = diffDays(dueKey, today);
  if (n === 1) return '明天到期';
  return `${n} 天后到期`;
}

export function diffDays(laterKey: string, earlierKey: string): number {
  const a = new Date(`${laterKey}T00:00:00`).getTime();
  const b = new Date(`${earlierKey}T00:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}
