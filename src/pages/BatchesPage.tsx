import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { PASS_SCORE, tagLabel } from '../domain/rules';
import { fmtDur, fmtHM, fullDayLabel } from '../domain/util';
import { AudioPlayback } from '../components/AudioPlayback';
import { useStore } from '../state/useStore';

export function BatchesPage() {
  const { store } = useStore();
  const [openId, setOpenId] = useState<string | null>(store.batches[store.batches.length - 1]?.id ?? null);

  const groups = useMemo(
    () =>
      [...store.batches]
        .sort((a, b) => (a.committedAt < b.committedAt ? 1 : -1))
        .reduce<Map<string, typeof store.batches>>((m, b) => {
          const arr = m.get(b.dateKey) ?? [];
          arr.push(b);
          m.set(b.dateKey, arr);
          return m;
        }, new Map()),
    [store.batches],
  );

  return (
    <div className="batches-wrap">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>
              <Layers size={18} /> 已提交批次
            </h2>
            <p>练习只按整批写入；被拦截的草稿不会出现在这里</p>
          </div>
        </div>

        {[...groups.entries()].map(([day, batches]) => (
          <div key={day} className="batch-day">
            <div className="batch-day-head">
              <strong>{fullDayLabel(day)}</strong>
              <span className="dim">
                {batches.length} 批 · 共 {fmtDur(batches.reduce((s, b) => s + b.totalSec, 0))}
              </span>
            </div>
            {batches.map(b => {
              const atts = b.attemptIds.map(id => store.attempts.find(a => a.id === id)!).filter(Boolean);
              const open = openId === b.id;
              return (
                <div key={b.id} className={`batch-card ${open ? 'open' : ''}`}>
                  <button className="batch-head" onClick={() => setOpenId(open ? null : b.id)}>
                    <span className="batch-id">批次 {b.id.slice(-6)}</span>
                    <span>{fmtHM(b.committedAt)}</span>
                    <span>{b.itemCount} 条</span>
                    <span>{fmtDur(b.totalSec)}</span>
                    <span className={atts.some(a => a.score < PASS_SCORE) ? 'warn' : 'good'}>
                      {atts.filter(a => a.score < PASS_SCORE).length} 条排复习
                    </span>
                    <span className="chev">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="batch-items">
                      {atts.map(a => (
                        <div key={a.id} className="batch-item">
                          <AudioPlayback audioId={a.audioId} size={26} />
                          <div className="batch-item-main">
                            <strong className="clamp">{a.phraseText}</strong>
                            <div className="draft-meta">
                              <span className={`score-pill ${a.score < PASS_SCORE ? 'low' : 'ok'}`}>
                                {a.score}
                              </span>
                              <span className="vtag">v{a.versionNo}</span>
                              <span className="dim">
                                {fmtDur(a.durationSec)} · {fmtHM(a.recordedAt)}
                              </span>
                            </div>
                            {a.wrongTags.length > 0 && (
                              <div className="tag-row">
                                {a.wrongTags.map(t => (
                                  <span key={t} className="wrong-tag">
                                    {tagLabel(t)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {store.batches.length === 0 && <div className="empty">还没有已提交批次</div>}
      </section>
    </div>
  );
}
