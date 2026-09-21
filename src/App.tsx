import { useState } from 'react';
import { Check, CheckCircle2, History, Mic, RotateCcw, Volume2, WifiOff } from 'lucide-react';
import { useDesk, selectConflicts } from './state/store';
import { openReviews } from './scheduler/scheduler';
import { StatsBar } from './ui/StatsBar';
import { ReviewQueue } from './ui/ReviewQueue';
import { PhraseLibrary } from './ui/PhraseLibrary';
import { PracticePanel } from './ui/PracticePanel';
import { BatchDock } from './ui/BatchDock';
import { PhraseModal } from './ui/PhraseModal';

export default function App() {
  const { state, today, dispatch } = useDesk();
  const [selectedId, setSelectedId] = useState<string | undefined>(state.phrases[0]?.id);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; phraseId: string } | null>(null);

  // 选中句被删除后回退到第一条；current 始终从最新状态派生，保证刷新后队列/批次/版本一致。
  const selected = state.phrases.find(p => p.id === selectedId) ?? state.phrases[0];
  const conflicts = selectConflicts(state, today);
  const pendingCount = openReviews(state, today).length;
  const masteredCount = state.phrases.filter(p => p.mastered).length;

  const editingPhrase = modal?.mode === 'edit' ? state.phrases.find(p => p.id === modal.phraseId) : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Volume2 size={19}/></div>
          <div><strong>声线练习室</strong><span>OFFLINE REVIEW DESK</span></div>
        </div>
        <div className="side-label">离线复习调度台</div>
        <nav>
          <button className="side-link active"><Mic size={17}/>练习库 <b>{state.phrases.length}</b></button>
          <button className="side-link"><History size={17}/>待复习 <b>{pendingCount}</b></button>
          <button className="side-link"><Check size={17}/>已掌握 <b>{masteredCount}</b></button>
        </nav>
        <div className="sidebar-foot">
          <div className="offline-card">
            <WifiOff size={15}/>
            <div><strong>离线运行</strong><span>数据存于浏览器本地，刷新后队列、批次与版本保持一致</span></div>
          </div>
          <button className="reset-btn" onClick={() => { if (confirm('清空全部本机数据并恢复示例？')) { dispatch({ type: 'RESET' }); setSelectedId(undefined); } }}>
            <RotateCcw size={13}/>重置示例数据
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">REVIEW SCHEDULE</p><h1>今日复习调度台</h1></div>
          <div className="top-actions">
            <span className="offline-pill"><CheckCircle2 size={13}/>已持久化 {state.attempts.length} 条录音 / {state.batches.length} 个批次</span>
          </div>
        </header>

        <StatsBar state={state} today={today}/>

        <ReviewQueue state={state} today={today} selectedId={selected?.id} onSelect={setSelectedId}/>

        <div className="content-grid">
          <PhraseLibrary state={state} today={today} selectedId={selected?.id}
            onSelect={setSelectedId} onAdd={() => setModal({ mode: 'add' })}/>
          {selected && (
            <PracticePanel
              state={state} today={today} phraseId={selected.id}
              onDelete={id => { dispatch({ type: 'DELETE_PHRASE', phraseId: id }); }}
              onEdit={id => setModal({ mode: 'edit', phraseId: id })}
              onAddDraft={d => dispatch({ type: 'ADD_DRAFT', draft: d })}
              onMaster={id => dispatch({ type: 'MARK_MASTERED', phraseId: id })}
            />
          )}
        </div>

        <BatchDock
          state={state} today={today} conflicts={conflicts}
          onCommit={() => dispatch({ type: 'COMMIT_BATCH' })}
          onRemoveDraft={id => dispatch({ type: 'REMOVE_DRAFT', draftId: id })}
          onClearDrafts={() => dispatch({ type: 'CLEAR_DRAFTS' })}
          onSelectPhrase={setSelectedId}
          onDismissCommit={() => dispatch({ type: 'CLEAR_LAST_COMMIT' })}
        />
      </main>

      {modal?.mode === 'add' && (
        <PhraseModal mode="add" onClose={() => setModal(null)} onSubmit={input => {
          dispatch({ type: 'ADD_PHRASE', input });
          setModal(null);
        }}/>
      )}
      {modal?.mode === 'edit' && editingPhrase && (
        <PhraseModal mode="edit" phrase={editingPhrase} onClose={() => setModal(null)} onSubmit={input => {
          dispatch({ type: 'EDIT_PHRASE', phraseId: editingPhrase.id, input });
          setModal(null);
        }}/>
      )}
    </div>
  );
}
