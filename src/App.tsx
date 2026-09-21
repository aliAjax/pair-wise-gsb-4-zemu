import { useState } from 'react';
import { AlarmClock, Layers, Mic, RotateCcw, Volume2 } from 'lucide-react';
import { StoreProvider, useStore } from './state/useStore';
import { PracticePage } from './pages/PracticePage';
import { QueuePage } from './pages/QueuePage';
import { BatchesPage } from './pages/BatchesPage';
import { dailyUsage, reviewQueue } from './domain/scheduler';
import { fullDayLabel, todayKey } from './domain/util';

type Tab = 'practice' | 'queue' | 'batches';
const TAB_KEY = 'voice-lab-scheduler:tab';

function Shell() {
  const { store, resetAll } = useStore();
  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(TAB_KEY);
    return saved === 'queue' || saved === 'batches' ? saved : 'practice';
  });
  const [focusVersionId, setFocusVersionId] = useState<string | null>(null);

  const today = todayKey();
  const openCount = reviewQueue(store, today).length;
  const usage = dailyUsage(store, today);
  const masteredCount = store.phrases.filter(p => p.mastered).length;

  const switchTab = (t: Tab) => {
    setTab(t);
    localStorage.setItem(TAB_KEY, t);
  };

  const goPractice = (versionId: string) => {
    setFocusVersionId(versionId);
    switchTab('practice');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Volume2 size={19} />
          </div>
          <div>
            <strong>声线练习室</strong>
            <span>OFFLINE REVIEW</span>
          </div>
        </div>
        <div className="side-label">离线复习调度台</div>
        <nav>
          <button className={tab === 'practice' ? 'side-link active' : 'side-link'} onClick={() => switchTab('practice')}>
            <Mic size={17} /> 练习台 <b>{store.phrases.length}</b>
          </button>
          <button className={tab === 'queue' ? 'side-link active' : 'side-link'} onClick={() => switchTab('queue')}>
            <AlarmClock size={17} /> 复习队列 <b className={openCount > 0 ? 'hot' : ''}>{openCount}</b>
          </button>
          <button className={tab === 'batches' ? 'side-link active' : 'side-link'} onClick={() => switchTab('batches')}>
            <Layers size={17} /> 批次记录 <b>{store.batches.length}</b>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="streak">
            <span>今日已练</span>
            <strong>
              {usage.count}
              <small> 条</small>
            </strong>
            <i>用时 {(usage.sec / 60).toFixed(1)} / 20 分钟 · 已掌握 {masteredCount}</i>
          </div>
          <button
            className="reset-btn"
            onClick={() => {
              if (window.confirm('重置全部本地数据并恢复示例？此操作不可撤销。')) resetAll();
            }}
          >
            <RotateCcw size={13} /> 重置示例数据
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{fullDayLabel(today)}</p>
            <h1>
              {tab === 'practice' && '今天练什么？'}
              {tab === 'queue' && '复习调度'}
              {tab === 'batches' && '批次记录'}
            </h1>
          </div>
          <p className="offline-pill">● 全离线 · 数据仅存本机</p>
        </header>

        {tab === 'practice' && (
          <PracticePage focusVersionId={focusVersionId} onFocusConsumed={() => setFocusVersionId(null)} />
        )}
        {tab === 'queue' && <QueuePage onPractice={goPractice} />}
        {tab === 'batches' && <BatchesPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
