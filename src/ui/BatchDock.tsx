import { AlertOctagon, ArrowDownUp, CheckCheck, Clock3, Inbox, X } from 'lucide-react';
import type { Conflict, DeskState } from '../domain/types';
import { fmtClock, fmtDuration } from '../domain/time';
import { DAILY_PER_PHRASE_LIMIT, DAILY_TIME_CAP_SEC } from '../scheduler/scheduler';

interface Props {
  state: DeskState;
  today: string;
  conflicts: Conflict[];
  onCommit: () => void;
  onRemoveDraft: (id: string) => void;
  onClearDrafts: () => void;
  onSelectPhrase: (id: string) => void;
  onDismissCommit: () => void;
}

// 冲突由页面经 selectConflicts 派生，组件只负责展示“句子 / 次数 / 原值 / 规则”。

const RULE_TEXT: Record<string, string> = {
  PER_PHRASE_DAILY_LIMIT: '规则：同一句每天最多 3 次',
  DAILY_TIME_CAP: '规则：当天总用时不超过 20 分钟',
};

export function BatchDock({ state, today, conflicts, onCommit, onRemoveDraft, onClearDrafts, onSelectPhrase, onDismissCommit }: Props) {
  const draftSec = state.drafts.reduce((s, d) => s + d.durationSec, 0);
  const usedSec = state.attempts.filter(a => a.dateKey === today).reduce((s, a) => s + a.durationSec, 0);
  const recentBatches = [...state.batches].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const blocked = state.drafts.length > 0 && conflicts.length > 0;

  return (
    <section className="dock">
      <div className="dock-head">
        <h2><Inbox size={16}/> 今日批次草稿台</h2>
        <div className="dock-head-right">
          <span className={blocked ? 'warn' : undefined}>
            {state.drafts.length} 条草稿 · 本批 {fmtDuration(draftSec)} · 提交后合计 {fmtDuration(usedSec + draftSec)} / 20:00
          </span>
          {state.drafts.length > 0 && <button className="ghost" onClick={onClearDrafts}>清空草稿</button>}
        </div>
      </div>

      {state.lastCommit && (
        <div className={`commit-toast ${state.lastCommit.ok ? 'ok' : 'fail'}`}>
          {state.lastCommit.ok
            ? <><CheckCheck size={14}/> 已原子写入 {state.lastCommit.count} 条录音，批次与复习队列已更新。</>
            : <><AlertOctagon size={14}/> 存在冲突，整批未写入，{state.lastCommit.count} 条草稿已保留，调整后重新提交。</>}
          <button className="icon-btn" onClick={onDismissCommit}><X size={13}/></button>
        </div>
      )}

      {state.drafts.length === 0 ? (
        <div className="dock-empty">录音后先进入这里暂存；通过“同句 ≤3 次 / 当日 ≤20 分钟”校验后才可整批写入。</div>
      ) : (
        <div className="dock-table">
          <div className="dock-row head">
            <div>句子（版本）</div><div>机器分</div><div>错音标签</div><div>用时</div><div></div>
          </div>
          {state.drafts.map(d => (
            <div key={d.id} className="dock-row draft">
              <button className="dock-phrase" onClick={() => onSelectPhrase(d.phraseId)} title="定位句子">
                {d.text}<em>v{d.versionN}</em>
              </button>
              <div><b className={d.score >= 85 ? 'score-pass' : 'score-fail'}>{d.score}</b></div>
              <div className="dock-tags">{d.wrongTags.length ? d.wrongTags.join('、') : <em>无</em>}</div>
              <div>{fmtDuration(d.durationSec)}</div>
              <button className="icon-btn" title="移出批次" onClick={() => onRemoveDraft(d.id)}><X size={14}/></button>
            </div>
          ))}
        </div>
      )}

      {blocked && (
        <div className="conflict-box">
          <h4><AlertOctagon size={14}/> 冲突明细（{conflicts.length} 项）— 整批拒绝写入，草稿保留</h4>
          {conflicts.map(c => (
            <div key={c.id} className="conflict-row">
              <div className="conflict-main">
                <span className="conflict-rule">{RULE_TEXT[c.rule]}</span>
                <b>{c.text}</b>
              </div>
              <div className="conflict-vals">
                {c.rule === 'DAILY_TIME_CAP' ? (
                  <span>合计用时 <b className="warn">{c.count} 秒</b>（{fmtDuration(c.count)}）· {c.original}</span>
                ) : (
                  <span>提交后次数 <b className="warn">{c.count} 次</b> · 上限 {DAILY_PER_PHRASE_LIMIT} 次 · {c.original}</span>
                )}
              </div>
            </div>
          ))}
          <div className="conflict-foot">
            处理方式：移出多余草稿、删除个别条目后重新提交；草稿不写入，今日已写入的 {fmtDuration(usedSec)} 不受影响。
          </div>
        </div>
      )}

      <div className="dock-actions">
        <button className="primary" disabled={state.drafts.length === 0 || blocked} onClick={onCommit}
          title={blocked ? '存在冲突，整批不能写入' : '校验通过后原子写入整批'}>
          <ArrowDownUp size={14}/>{blocked ? '整批阻止写入' : '校验并整批写入'}
        </button>
        <span>原子提交：任一条触发 {DAILY_PER_PHRASE_LIMIT} 次/句 或 {DAILY_TIME_CAP_SEC / 60} 分钟/天 上限，全批回退保留草稿。</span>
      </div>

      <div className="batch-history">
        <h4><Clock3 size={13}/> 已写入批次</h4>
        {recentBatches.length === 0 && <small>还没有写入记录</small>}
        {recentBatches.map(b => (
          <div key={b.id} className="batch-line">
            <b>{fmtClock(b.at, today)}</b>
            <span>{b.attemptIds.length} 条录音</span>
            <em>{fmtDuration(b.durationSec)}</em>
            {b.dateKey === today && <i>今天</i>}
          </div>
        ))}
      </div>
    </section>
  );
}
