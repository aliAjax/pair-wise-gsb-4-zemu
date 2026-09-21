import { CalendarClock, CheckCircle2, Clock3, ListChecks } from 'lucide-react';
import type { DeskState } from '../domain/types';
import { fmtDuration, prettyDate } from '../domain/time';
import { DAILY_PER_PHRASE_LIMIT, DAILY_TIME_CAP_SEC, openReviews } from '../scheduler/scheduler';

interface Props {
  state: DeskState;
  today: string;
}

export function StatsBar({ state, today }: Props) {
  const todayAttempts = state.attempts.filter(a => a.dateKey === today);
  const usedSec = todayAttempts.reduce((s, a) => s + a.durationSec, 0);
  const draftSec = state.drafts.reduce((s, d) => s + d.durationSec, 0);
  const pending = openReviews(state, today);
  const due = pending.filter(r => r.dueKey <= today).length;
  const mastered = state.phrases.filter(p => p.mastered).length;
  const pct = Math.min(100, (usedSec / DAILY_TIME_CAP_SEC) * 100);
  const over = usedSec + draftSec > DAILY_TIME_CAP_SEC;

  return (
    <>
      <p className="desk-date">{prettyDate(today)} · 离线模式，数据仅存本机</p>
      <section className="stats">
        <div>
          <span><Clock3 size={12}/> 今日已写入用时</span>
          <strong>{fmtDuration(usedSec)} <em>/ 20:00</em></strong>
          <div className="progress"><i className={over ? 'over' : ''} style={{ width: `${pct}%` }}/></div>
          <small>草稿批次 {fmtDuration(draftSec)} 待提交</small>
        </div>
        <div>
          <span><ListChecks size={12}/> 今日写入录音</span>
          <strong>{todayAttempts.length} <em>条</em></strong>
          <small>每句每日上限 {DAILY_PER_PHRASE_LIMIT} 次</small>
        </div>
        <div>
          <span><CalendarClock size={12}/> 待复习</span>
          <strong className={due > 0 ? 'warn' : ''}>{pending.length} <em>条</em></strong>
          <small className={due > 0 ? 'warn' : ''}>{due > 0 ? `${due} 条已到期/逾期` : '暂无到期复习'}</small>
        </div>
        <div>
          <span><CheckCircle2 size={12}/> 已掌握</span>
          <strong className="green">{mastered} <em>/ {state.phrases.length}</em></strong>
          <small>达标且复习清零才可标记</small>
        </div>
      </section>
    </>
  );
}
