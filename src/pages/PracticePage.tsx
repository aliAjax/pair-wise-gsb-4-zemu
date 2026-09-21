import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  History,
  Mic,
  Pause,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { PASS_SCORE, PER_PHRASE_LIMIT, scoreTake, tagLabel } from '../domain/rules';
import {
  canDeletePhrase,
  canMaster,
  currentVersion,
  dailyUsage,
  latestAttempt,
  usedCountToday,
  versionHistory,
} from '../domain/scheduler';
import type { DraftItem } from '../domain/types';
import { fmtDur, fmtHM, fullDayLabel, todayKey } from '../domain/util';
import { AudioPlayback } from '../components/AudioPlayback';
import { ConflictList } from '../components/ConflictList';
import { PhraseModal } from '../components/PhraseModal';
import { useStore } from '../state/useStore';
import { useRecorder } from '../state/useRecorder';

export function PracticePage({ focusVersionId, onFocusConsumed }: { focusVersionId?: string | null; onFocusConsumed?: () => void }) {
  const {
    store, addTake, removeDraftItem, clearDraft, commit,
    editPhrase, addPhrase: createPhrase, removePhrase, toggleMastered,
  } = useStore();
  const rec = useRecorder();

  const [selected, setSelected] = useState(store.phrases[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [toast, setToast] = useState('');

  // 复习队列跳转：选中对应句子（已改版的版本 -> 其实体）
  useEffect(() => {
    if (focusVersionId) {
      const v = store.versions.find(x => x.id === focusVersionId);
      if (v) setSelected(v.phraseId);
      onFocusConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVersionId]);

  const phrase = store.phrases.find(p => p.id === selected) ?? store.phrases[0];
  const version = phrase ? currentVersion(store, phrase.id) : undefined;
  const usage = dailyUsage(store);
  const today = todayKey();

  const filtered = useMemo(
    () =>
      store.phrases.filter(p => {
        const v = currentVersion(store, p.id);
        return v?.text.toLowerCase().includes(query.toLowerCase());
      }),
    [store.phrases, store.versions, query],
  );

  const draft = store.draft;
  const conflicts = draft?.lastConflicts ?? [];

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  const handleRecordClick = async () => {
    if (!version) return;
    if (rec.recording) {
      const r = await rec.stop();
      finishTake(r.audioId, r.durationSec);
    } else {
      const ok = await rec.start();
      if (!ok) rec.startSimulated(); // 拒绝/无麦克风：离线模拟计时
    }
  };

  const handleSimStop = () => {
    const r = rec.stopSimulated();
    finishTake(r.audioId, r.durationSec);
  };

  const finishTake = (audioId: string | null, durationSec: number) => {
    if (!version || !phrase) return;
    const { score, wrongTags } = scoreTake();
    addTake({
      phraseId: phrase.id,
      versionId: version.id,
      versionNo: version.versionNo,
      phraseText: version.text,
      translation: version.translation,
      score,
      wrongTags,
      durationSec,
      audioId: audioId ?? undefined,
    });
    flash(score < PASS_SCORE ? `机器分 ${score} · 已进入草稿，提交后安排次日复习` : `机器分 ${score} · 达标`);
  };

  const handleCommit = () => {
    const r = commit();
    flash(r.ok ? '批次已写入' : '超过规则限制，整批未写入，草稿保留');
  };

  const minutesUsed = usage.sec / 60;
  const capMin = usage.capSec / 60;

  return (
    <div className="page-grid">
      {/* 左：句子库 */}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>句子库</h2>
            <p>选择句子开始练习；改版后旧录音与分数归旧版本</p>
          </div>
          <button className="primary small" onClick={() => setModal('add')}>
            <Plus size={14} /> 添加
          </button>
        </div>
        <input
          className="search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索句子…"
        />
        <div className="phrase-list tight">
          {filtered.map(p => {
            const v = currentVersion(store, p.id);
            const n = usedCountToday(store, v?.id ?? '');
            const latest = latestAttempt(store, v?.id ?? '');
            return (
              <button
                key={p.id}
                className={`phrase ${p.id === phrase?.id ? 'selected' : ''}`}
                onClick={() => setSelected(p.id)}
              >
                <div className={`phrase-icon ${p.mastered ? 'ok' : ''}`}>
                  {p.mastered ? <Check size={15} /> : <Mic size={15} />}
                </div>
                <div className="phrase-copy">
                  <strong>{v?.text}</strong>
                  <span>
                    {p.tag} · {p.level}
                    {v && v.versionNo > 1 ? ` · v${v.versionNo}` : ''}
                  </span>
                  <div className="phrase-meta">
                    <small>今日 {n}/{PER_PHRASE_LIMIT}</small>
                    {latest && <small>最近 {latest.score} 分</small>}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="empty">没有匹配的句子</div>}
        </div>
      </section>

      {/* 中：练习区 */}
      {phrase && version && (
        <section className="panel practice-panel">
          <div className="practice-head">
            <div>
              <span className="label">
                CURRENT · v{version.versionNo} · {fullDayLabel(today)}
              </span>
              <h2 className="focus-text">{version.text}</h2>
              <p className="focus-translation">{version.translation}</p>
            </div>
            <div className="head-icons">
              <button className="icon-btn" title="修改句子（生成新版本，旧录音/分数归旧版本）" onClick={() => setModal('edit')}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn danger"
                title={canDeletePhrase(store, phrase.id) ? '删除句子' : '已有练习记录，不可删除'}
                disabled={!canDeletePhrase(store, phrase.id)}
                onClick={() => {
                  removePhrase(phrase.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="meter-row">
            <div className="meter">
              <div className="meter-top">
                <span>今日总用时</span>
                <strong className={minutesUsed > capMin ? 'over' : ''}>
                  {minutesUsed.toFixed(1)} / {capMin} 分钟
                </strong>
              </div>
              <div className="progress">
                <i
                  className={minutesUsed > capMin ? 'over' : ''}
                  style={{ width: `${Math.min(100, (usage.sec / usage.capSec) * 100)}%` }}
                />
              </div>
            </div>
            <div className="meter">
              <div className="meter-top">
                <span>本句今日次数</span>
                <strong>
                  {usedCountToday(store, version.id)} / {PER_PHRASE_LIMIT}
                </strong>
              </div>
              <div className="progress">
                <i
                  style={{ width: `${(usedCountToday(store, version.id) / PER_PHRASE_LIMIT) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="record-card">
            <div className="record-top">
              <div>
                <span className="label">YOUR TAKE · 离线机器评分</span>
                <h3>
                  {rec.recording
                    ? '正在录音…'
                    : rec.unsupported
                      ? '未获取麦克风，可用模拟计时练习'
                      : '读完后停止，自动评分'}
                </h3>
              </div>
              <span className="record-time">{fmtDur(rec.seconds)}</span>
            </div>
            <div className="record-actions">
              {!rec.recording ? (
                <button className="record-button" onClick={handleRecordClick}>
                  <Mic size={16} /> 开始录音
                </button>
              ) : (
                <button className="record-button recording" onClick={rec.unsupported ? handleSimStop : handleRecordClick}>
                  <Pause size={16} /> 停止并评分
                </button>
              )}
            </div>
            <p className="hint-line">
              机器分低于 {PASS_SCORE} 分将在提交后安排次日复习；完成复习前不能标记已掌握。
            </p>
          </div>

          <MasterBox
            mastered={phrase.mastered}
            onToggle={v => {
              const r = canMaster(store, phrase);
              if (!v || r.ok) toggleMastered(phrase.id, v);
              else flash(`无法标记已掌握：${r.reason}`);
            }}
          />

          <VersionHistory phraseId={phrase.id} />
        </section>
      )}

      {/* 右：批次草稿 */}
      <section className="panel draft-panel">
        <div className="section-head">
          <div>
            <h2>本批草稿</h2>
            <p>多次练习攒成一批，一次提交</p>
          </div>
          {draft && draft.items.length > 0 && (
            <button className="ghost small" onClick={clearDraft}>
              清空
            </button>
          )}
        </div>

        {conflicts.length > 0 && <ConflictList conflicts={conflicts} />}

        <div className="draft-list">
          {draft?.items.map((it: DraftItem) => (
            <div key={it.id} className="draft-item">
              <div className="draft-main">
                <strong className="clamp">{it.phraseText}</strong>
                <div className="draft-meta">
                  <span className={`score-pill ${it.score < PASS_SCORE ? 'low' : 'ok'}`}>{it.score}</span>
                  <Clock3 size={12} /> {fmtDur(it.durationSec)}
                  <span className="dim">{fmtHM(it.recordedAt)}</span>
                  {it.versionNo > 1 && <span className="vtag">v{it.versionNo}</span>}
                </div>
                {it.wrongTags.length > 0 && (
                  <div className="tag-row">
                    {it.wrongTags.map(t => (
                      <span key={t} className="wrong-tag">
                        {tagLabel(t)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="draft-side">
                <AudioPlayback audioId={it.audioId} size={26} />
                <button className="icon-btn danger" onClick={() => removeDraftItem(it.id)} title="移出本批">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          {!draft || draft.items.length === 0 ? (
            <div className="empty">
              还没有草稿。完成一次录音后进入此处；提交前不会写入正式记录。
            </div>
          ) : (
            <div className="draft-foot">
              <div className="draft-sum">
                <span>{draft.items.length} 条</span>
                <span>合计 {fmtDur(draft.items.reduce((s, i) => s + i.durationSec, 0))}</span>
                <span>
                  {draft.items.filter(i => i.score < PASS_SCORE).length} 条待复习
                </span>
              </div>
              <button className="primary" onClick={handleCommit}>
                <Send size={14} /> 整批提交
              </button>
            </div>
          )}
        </div>
      </section>

      {modal === 'add' && (
        <PhraseModal
          title="添加句子"
          onCancel={() => setModal(null)}
          onSave={v => {
            const id = createPhrase(v.text, v.translation, v.tag, v.level);
            setSelected(id);
            setModal(null);
          }}
        />
      )}
      {modal === 'edit' && version && (
        <PhraseModal
          title={`修改句子 · 将生成 v${version.versionNo + 1}`}
          initial={{ text: version.text, translation: version.translation, tag: phrase.tag, level: phrase.level }}
          warning="保存后旧版本只读保留：旧录音与机器分仍归旧版本，旧版未完成复习自动归档，新版本需重新达标。"
          onCancel={() => setModal(null)}
          onSave={v => {
            editPhrase(phrase.id, v.text, v.translation, v.tag, v.level);
            setModal(null);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function MasterBox({ mastered, onToggle }: { mastered: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className={`master-box ${mastered ? 'on' : ''}`}>
      <div>
        <strong>{mastered ? '已标记掌握' : '标记已掌握'}</strong>
        <span>存在未完成的次日复习或最近一次低于 85 分时，按钮不生效</span>
      </div>
      <button
        className={mastered ? 'secondary' : 'primary'}
        disabled={false}
        onClick={() => onToggle(!mastered)}
      >
        <Check size={14} /> {mastered ? '取消掌握' : '标为已掌握'}
      </button>
    </div>
  );
}

function VersionHistory({ phraseId }: { phraseId: string }) {
  const { store } = useStore();
  const phrase = store.phrases.find(p => p.id === phraseId);
  if (!phrase) return null;
  const rows = versionHistory(store, phrase);
  if (rows.length === 0) return null;
  return (
    <div className="history-box">
      <div className="history-title">
        <History size={13} /> 旧版本（录音与分数按版本保留）
      </div>
      {rows
        .slice()
        .reverse()
        .map(r => (
          <div key={r.id} className="history-row">
            <span className="vtag">v{r.versionNo}</span>
            <span className="clamp">{r.text}</span>
            <span className="dim">{r.attempts} 次</span>
            <span>{r.bestScore !== null ? `最佳 ${r.bestScore}` : '—'}</span>
            {r.openReviews > 0 && <span className="warn-tag">待复习 {r.openReviews}</span>}
            {r.supersededReviews > 0 && <span className="dim-tag">复习已归档 {r.supersededReviews}</span>}
          </div>
        ))}
    </div>
  );
}
