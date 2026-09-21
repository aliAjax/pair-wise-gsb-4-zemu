import { AlarmClock, ArrowRight, CheckCircle2, History } from 'lucide-react';
import { reviewQueue } from '../domain/scheduler';
import { dueLabel, fmtDur, fullDayLabel, todayKey } from '../domain/util';
import { AudioPlayback } from '../components/AudioPlayback';
import { useStore } from '../state/useStore';

export function QueuePage({ onPractice }: { onPractice: (versionId: string) => void }) {
  const { store } = useStore();
  const today = todayKey();
  const queue = reviewQueue(store, today);

  const done = store.reviews.filter(r => r.status === 'done');
  const superseded = store.reviews.filter(r => r.status === 'superseded');

  const causeAttempt = (id: string) => store.attempts.find(a => a.id === id);

  return (
    <div className="queue-wrap">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>
              <AlarmClock size={18} /> 次日复习队列
            </h2>
            <p>机器分低于 85 的句子自动排入次日；完成达标练习前不能标记已掌握</p>
          </div>
          <span className="count-pill">{queue.length} 待复习</span>
        </div>

        <div className="queue-list">
          {queue.map(r => {
            const cause = causeAttempt(r.causedByAttemptId);
            return (
              <div key={r.id} className={`queue-row ${r.overdue ? 'overdue' : ''}`}>
                <div className="queue-main">
                  <strong>{r.phraseText}</strong>
                  <div className="queue-meta">
                    <span className={`due ${r.overdue ? 'over' : ''}`}>{dueLabel(r.dueKey, today)}</span>
                    <span className="vtag">v{r.versionNo}</span>
                    <span className="dim">触发分 {r.causeScore}</span>
                    <span className="dim">到期 {fullDayLabel(r.dueKey)}</span>
                  </div>
                  {cause && (
                    <div className="queue-cause">
                      <AudioPlayback audioId={cause.audioId} size={24} />
                      <span className="dim">
                        触发练习用时 {fmtDur(cause.durationSec)} · {cause.wrongTags.length} 个错音标签
                      </span>
                    </div>
                  )}
                </div>
                <button className="primary small" onClick={() => onPractice(r.versionId)}>
                  去练习 <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
          {queue.length === 0 && (
            <div className="empty">
              <CheckCircle2 size={20} /> 当前没有待复习句子
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>
              <History size={16} /> 已完成 / 已归档复习
            </h2>
            <p>改版句子的旧复习自动归档，记录保留不丢失</p>
          </div>
        </div>
        <table className="plain-table">
          <thead>
            <tr>
              <th>句子</th>
              <th>状态</th>
              <th>触发分</th>
              <th>到期日</th>
            </tr>
          </thead>
          <tbody>
            {[...done, ...superseded]
              .sort((a, b) => (a.dueKey < b.dueKey ? 1 : -1))
              .map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="clamp">{r.phraseText}</span>
                    <small className="dim"> v{r.versionNo}</small>
                  </td>
                  <td>
                    {r.status === 'done' ? (
                      <span className="badge done">已完成</span>
                    ) : (
                      <span className="badge sup">改版归档</span>
                    )}
                  </td>
                  <td>{r.causeScore}</td>
                  <td className="dim">{r.dueKey}</td>
                </tr>
              ))}
            {done.length + superseded.length === 0 && (
              <tr>
                <td colSpan={4} className="dim">
                  暂无
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
