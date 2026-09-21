import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic, Pause, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import type { DeskState } from '../domain/types';
import { fmtDuration } from '../domain/time';
import { machineScore } from '../domain/scoring';
import { canMaster, currentVersion, phraseAttempts, DAILY_PER_PHRASE_LIMIT } from '../scheduler/scheduler';

const bars = Array.from({ length: 68 }, (_, i) => 18 + ((i * 29) % 44));

interface Candidate {
  score: number;
  wrongTags: string[];
  durationSec: number;
  takeOfDay: number;
}

interface Props {
  state: DeskState;
  today: string;
  phraseId?: string;
  onDelete: (phraseId: string) => void;
  onEdit: (phraseId: string) => void;
  onAddDraft: (d: {
    phraseId: string; versionId: string; versionN: number; text: string;
    score: number; wrongTags: string[]; durationSec: number; at: string;
  }) => void;
  onMaster: (phraseId: string) => void;
}

export function PracticePanel({ state, today, phraseId, onDelete, onEdit, onAddDraft, onMaster }: Props) {
  const phrase = state.phrases.find(p => p.id === phraseId) ?? state.phrases[0];
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // 切换句子时重置录音台
  useEffect(() => {
    setCandidate(null);
    setRecording(false);
    setSeconds(0);
    setPlaying(false);
  }, [phrase?.id, phrase?.currentVersionId]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!phrase) return <section className="practice"><div className="empty">还没有句子，先添加一句</div></section>;

  const version = currentVersion(phrase);
  const todayCount = state.attempts.filter(a => a.dateKey === today && a.phraseId === phrase.id).length;
  const draftCount = state.drafts.filter(d => d.phraseId === phrase.id).length;
  const projectedCount = todayCount + draftCount;
  const atLimit = projectedCount >= DAILY_PER_PHRASE_LIMIT;
  const attempts = phraseAttempts(state, phrase.id);
  const master = canMaster(state, phrase.id, today);
  const passed = attempts.some(a => a.versionId === version.id && a.score >= 85);

  const stop = () => {
    window.clearInterval(timer.current);
    setRecording(false);
    const dur = Math.max(1, seconds);
    const { score, wrongTags } = machineScore([phrase.id, version.id, today, todayCount + draftCount, dur]);
    setCandidate({ score, wrongTags, durationSec: dur, takeOfDay: projectedCount + 1 });
  };
  const start = () => {
    setCandidate(null);
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const addToBatch = () => {
    if (!candidate) return;
    onAddDraft({
      phraseId: phrase.id, versionId: version.id, versionN: version.n, text: version.text,
      score: candidate.score, wrongTags: candidate.wrongTags, durationSec: candidate.durationSec,
      at: new Date().toISOString(),
    });
    setCandidate(null);
    setSeconds(0);
  };

  return (
    <section className="practice">
      <div className="practice-head">
        <div><span className="label">CURRENT PHRASE · v{version.n}</span><h2>录音与调度</h2></div>
        <div className="head-actions">
          <button className="icon-btn" title="修改句子（产生新版本）" onClick={() => onEdit(phrase.id)}><Pencil size={15}/></button>
          <button className="icon-btn" title="删除句子" onClick={() => { if (confirm(`删除「${version.text}」及其全部版本、录音与复习？`)) onDelete(phrase.id); }}><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="focus-card">
        <div className="focus-tag">{phrase.tag} · {phrase.level}{phrase.mastered && ' · 已掌握'}</div>
        <p className="focus-text">{version.text}</p>
        <p className="focus-translation">{version.translation}</p>
        <div className="audio-sample">
          <button className="round-btn" onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
          <div className="sample-wave">{bars.map((h, i) => <i key={i} style={{ height: `${h * (playing ? 1.15 : 0.72)}%` }}/>)}</div>
          <span>示范 0:08</span>
        </div>
      </div>

      <div className="record-card">
        <div className="record-top">
          <div>
            <span className="label">YOUR RECORDING</span>
            <h3>{recording ? '正在录音…' : candidate ? '机器评分完成，加入今日批次' : '准备好后开始录音'}</h3>
          </div>
          <span className="record-time">{fmtDuration(recording ? seconds : candidate?.durationSec ?? 0)}</span>
        </div>
        <div className="record-wave">{bars.slice(5, 58).map((h, i) => (
          <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? 0.4 + (i % 5) / 7 : 0.4)}%` }}/>
        ))}</div>
        {candidate && (
          <div className={`candidate ${candidate.score >= 85 ? 'pass' : 'fail'}`}>
            <div className="cand-score"><b>{candidate.score}</b><span>机器分{candidate.score >= 85 ? ' · 达标' : ' · 低于 85，提交后排次日复习'}</span></div>
            <div className="cand-tags">
              {candidate.wrongTags.length === 0 ? <em>未检出明显错音</em> : candidate.wrongTags.map(t => <i key={t}>{t}</i>)}
            </div>
            <small>用时 {fmtDuration(candidate.durationSec)} · 今日第 {candidate.takeOfDay} 次</small>
          </div>
        )}
        <div className="record-actions">
          {recording ? (
            <button className="record-button recording" onClick={stop}><span><Pause size={15}/></span>结束录音并评分</button>
          ) : candidate ? (
            <>
              <button className="record-button" onClick={addToBatch}><span><Mic size={15}/></span>加入批次（暂存草稿）</button>
              <button className="secondary" onClick={start}><RotateCcw size={14}/>重录</button>
            </>
          ) : (
            <button className="record-button" onClick={start} disabled={atLimit} title={atLimit ? '该句今日已达 3 次' : ''}>
              <span><Mic size={15}/></span>{atLimit ? '今日已达 3 次上限' : '开始录音'}
            </button>
          )}
          {candidate && !recording && <button className="secondary" onClick={() => setPlaying(v => !v)}><Play size={14}/>回放</button>}
        </div>
        <p className="rule-note">该句今日已写入 {todayCount}/3，草稿 {draftCount} 条；录音先进草稿批次，整批校验通过才写入。</p>
      </div>

      <div className="master-row">
        <button className="primary" disabled={phrase.mastered || !master.ok} title={master.reason} onClick={() => onMaster(phrase.id)}>
          <CheckCircle2 size={15}/>{phrase.mastered ? '已掌握' : master.ok ? '标记为已掌握' : `不能标记：${master.reason}`}
        </button>
        <span>{passed ? '已有 ≥85 分录音' : '尚无 ≥85 分录音'}，复习完成前不可标记。</span>
      </div>

      <div className="version-box">
        <h4>版本与录音（{phrase.versions.length} 个版本 · {attempts.length} 条已写入）</h4>
        {[...phrase.versions].reverse().map(v => {
          const va = attempts.filter(a => a.versionId === v.id);
          return (
            <div key={v.id} className={`ver-block ${v.id === version.id ? 'current' : 'old'}`}>
              <div className="ver-line"><b>v{v.n}</b>{v.id === version.id ? <i>当前版本</i> : <i>旧版本 · 录音分数归此版本</i>}</div>
              <p>{v.text}</p>
              {va.length === 0 ? <small>本版本暂无已写入录音</small> : va.slice(0, 4).map(a => (
                <div key={a.id} className={`attempt-line ${a.score >= 85 ? 'pass' : 'fail'}`}>
                  <b>{a.score}</b>
                  <span>{a.wrongTags.length ? a.wrongTags.join('、') : '无错音标签'}</span>
                  <em>{fmtDuration(a.durationSec)}</em>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
