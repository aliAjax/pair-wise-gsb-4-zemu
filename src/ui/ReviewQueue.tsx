import { AlertTriangle, CalendarClock, History } from 'lucide-react';
import type { DeskState } from '../domain/types';
import { dueLabel } from '../domain/time';
import { currentVersion, openReviews } from '../scheduler/scheduler';

interface Props {
  state: DeskState;
  today: string;
  selectedId?: string;
  onSelect: (phraseId: string) => void;
}

export function ReviewQueue({ state, today, selectedId, onSelect }: Props) {
  const pending = openReviews(state, today);
  return (
    <section className="review-queue">
      <div className="queue-head">
        <h2><CalendarClock size={16}/> 复习队列</h2>
        <span>{pending.length} 条待完成 · 低于 85 分自动排入次日</span>
      </div>
      {pending.length === 0 && <div className="queue-empty">队列已清空，去练一句新的吧</div>}
      <div className="queue-list">
        {pending.map(r => {
          const phrase = state.phrases.find(p => p.id === r.phraseId);
          const stale = phrase ? currentVersion(phrase).id !== r.versionId : false;
          const due = r.dueKey <= today;
          return (
            <button
              key={r.id}
              className={`queue-item ${selectedId === r.phraseId ? 'selected' : ''} ${due ? 'due' : ''}`}
              onClick={() => onSelect(r.phraseId)}
              title={r.reason}
            >
              <div className="queue-due">
                <b className={due ? 'warn' : ''}>{dueLabel(r.dueKey, today)}</b>
                <span>v{r.versionN}{stale && ' · 旧版本句子'}</span>
              </div>
              <div className="queue-text">{r.text}</div>
              <div className="queue-reason">
                {stale && <i><History size={11}/> 句子已修改，用当前版本录音 ≥85 即可完成</i>}
                {!stale && <i><AlertTriangle size={11}/> {r.reason}</i>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
