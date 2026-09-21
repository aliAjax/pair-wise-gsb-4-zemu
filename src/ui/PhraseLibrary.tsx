import { Check, ChevronRight, Mic, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DeskState, Phrase } from '../domain/types';
import { fmtClock } from '../domain/time';
import { currentVersion, openReviews } from '../scheduler/scheduler';
import { selectPhraseTodayCount } from '../state/store';

interface Props {
  state: DeskState;
  today: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function PhraseLibrary({ state, today, selectedId, onSelect, onAdd }: Props) {
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const tags = useMemo(() => ['全部', ...Array.from(new Set(state.phrases.map(p => p.tag)))], [state.phrases]);
  const filtered = useMemo(
    () =>
      state.phrases.filter(
        p =>
          (filter === '全部' || p.tag === filter) &&
          currentVersion(p).text.toLowerCase().includes(query.toLowerCase()),
      ),
    [state.phrases, filter, query],
  );
  const openSet = new Set(openReviews(state, today).map(r => r.phraseId));

  return (
    <section className="library">
      <div className="section-head">
        <div><h2>句子库</h2><p>{state.phrases.length} 句 · 版本与录音分开保存</p></div>
        <button className="primary" onClick={onAdd}><Plus size={15}/>添加句子</button>
      </div>
      <div className="lib-tools">
        <div className="filters">{tags.map(t => (
          <button key={t} className={filter === t ? 'chip active' : 'chip'} onClick={() => setFilter(t)}>{t}</button>
        ))}</div>
        <div className="search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索句子"/></div>
      </div>
      <div className="phrase-list">
        {filtered.map(p => <LibraryRow key={p.id} phrase={p} state={state} today={today}
          selected={p.id === selectedId} hasReview={openSet.has(p.id)} onSelect={() => onSelect(p.id)}/>)}
        {filtered.length === 0 && <div className="empty">没有匹配的句子</div>}
      </div>
    </section>
  );
}

function LibraryRow({ phrase, state, today, selected, hasReview, onSelect }: {
  phrase: Phrase; state: DeskState; today: string; selected: boolean; hasReview: boolean; onSelect: () => void;
}) {
  const v = currentVersion(phrase);
  const used = selectPhraseTodayCount(state, phrase.id, today);
  const drafts = state.drafts.filter(d => d.phraseId === phrase.id).length;
  const last = state.attempts.filter(a => a.phraseId === phrase.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <button className={selected ? 'phrase selected' : 'phrase'} onClick={onSelect}>
      <div className="phrase-icon">{phrase.mastered ? <Check size={15}/> : <Mic size={15}/>}</div>
      <div className="phrase-copy">
        <strong>{v.text}{v.n > 1 && <em className="ver-tag">v{v.n}</em>}</strong>
        <span>{v.translation}</span>
        <div className="phrase-meta">
          <i>{phrase.tag}</i><i>{phrase.level}</i>
          <small>今日 {used}/3{drafts > 0 ? ` · 草稿 ${drafts}` : ''}</small>
          {hasReview && <small className="review-dot">待复习</small>}
          {last && <small>最近 {last.score} 分 · {fmtClock(last.at, today)}</small>}
        </div>
      </div>
      <ChevronRight size={17}/>
    </button>
  );
}
