// @ts-nocheck 测试脚本：Node API 类型不在应用依赖内
import assert from 'node:assert';
import { buildSeed } from '../src/domain/seed';
import {
  canMaster,
  commitBatch,
  dailyUsage,
  editPhrase,
  reviewQueue,
  usedCountToday,
  usedSecondsToday,
  validateBatch,
  versionHistory,
} from '../src/domain/scheduler';
import type { DraftItem, Store } from '../src/domain/types';
import { addDaysKey, dateKey, todayKey } from '../src/domain/util';

let passed = 0;
const ok = (name: string, cond: unknown) => {
  assert.ok(cond, name);
  passed++;
  console.log('✓', name);
};

// 固定一个“现在”，保证种子日期一致
const now = new Date('2026-09-20T10:00:00');
const today = dateKey(now);
const tomorrow = addDaysKey(today, 1);

let store: Store = buildSeed(now);

// --- 种子：句2 今天已 1 次 78 分，有 open 复习，明天到期
const p2 = store.phrases.find(p => p.id === 'phr_seed_2')!;
const v2 = store.versions.find(v => v.id === 'ver_seed_2_1')!;
ok('种子：今日已写入 1 次', usedCountToday(store, v2.id, today) === 1);
ok('种子：今日总用时 7 秒', usedSecondsToday(store, today) === 7);
const q0 = reviewQueue(store, today);
ok('种子：复习队列 1 条 open', q0.length === 1);
ok('种子：低分复习顺延到明天', q0[0].dueKey === tomorrow);

// --- 草稿工具
const take = (
  s: Store,
  phraseId: string,
  versionId: string,
  score: number,
  durationSec: number,
): DraftItem => {
  const v = s.versions.find(x => x.id === versionId)!;
  return {
    id: `drf_${Math.random()}`,
    phraseId,
    versionId,
    versionNo: v.versionNo,
    phraseText: v.text,
    translation: v.translation,
    score,
    wrongTags: score < 85 ? ['th'] : [],
    durationSec,
    recordedAt: now.toISOString(),
    dateKey: today,
  };
};

// --- 规则一：同一句每天最多三次（已 1 + 批 3 = 4 > 3）
store = { ...store, draft: { updatedAt: now.toISOString(), lastConflicts: [],
  items: [take(store, p2.id, v2.id, 90, 5), take(store, p2.id, v2.id, 91, 5), take(store, p2.id, v2.id, 92, 5)] } };
const conflicts = validateBatch(store, store.draft!.items, today);
ok('规则一：超限产生 1 条冲突', conflicts.length === 1);
const cc = conflicts[0].counts!;
ok('规则一：冲突含原值 1 / 本批 3 / 合并 4 / 上限 3',
  cc.base === 1 && cc.add === 3 && cc.result === 4 && cc.limit === 3);

const rejected = commitBatch(store, now);
ok('规则一：整批不写入（attempts 不变）', rejected.store.attempts.length === store.attempts.length);
ok('规则一：草稿保留', rejected.store.draft !== null && rejected.store.draft!.items.length === 3);

// --- 规则二：当天总用时不超过 20 分钟（另一句，次数不超，但总时长超）
const p4 = store.phrases.find(p => p.id === 'phr_seed_4')!;
const v4 = store.versions.find(v => v.id === 'ver_seed_4_1')!;
const big: DraftItem[] = [take(store, p4.id, v4.id, 90, 19 * 60 + 55)]; // 7 + 1195 = 1202 > 1200
const c2 = validateBatch(store, big, today);
ok('规则二：总用时超限拦截', c2.some(c => c.rule === 'DAILY_TIME_CAP'));
ok('规则二：秒数原值 7 / 合并 1202 / 上限 1200',
  c2[0].seconds!.base === 7 && c2[0].seconds!.result === 1202 && c2[0].seconds!.limit === 1200);

// --- 合法批次：2 条，一条低分 -> 写批次、安排次日复习
const good: DraftItem[] = [
  take(store, p4.id, v4.id, 70, 20),       // 新句子低分 -> 明天复习
  take(store, p2.id, v2.id, 95, 10),       // 句2 达标 -> 完成 open 复习
];
store = { ...store, draft: { updatedAt: now.toISOString(), lastConflicts: [], items: good } };
const before = store.attempts.length;
const committed = commitBatch(store, now);
ok('合法批次：无冲突', committed.conflicts.length === 0);
ok('合法批次：写入 2 条 attempt', committed.store.attempts.length === before + 2);
ok('合法批次：草稿清空', committed.store.draft === null);
ok('合法批次：生成 1 条 batch 记录', committed.store.batches.length === store.batches.length + 1);
store = committed.store;

const rev4 = store.reviews.find(r => r.versionId === v4.id)!;
ok('调度：低分安排次日复习（明天，cause 70）',
  rev4 && rev4.status === 'open' && rev4.dueKey === tomorrow && rev4.causeScore === 70);
const rev2 = store.reviews.find(r => r.versionId === v2.id)!;
ok('调度：达标练习完成原复习', rev2.status === 'done' && rev2.completedByBatchId);

// --- 已掌握门禁：句4 有 open 复习，不能掌握
const gate = canMaster(store, p4);
ok('门禁：有未完成复习不能标掌握', !gate.ok && /复习/.test(gate.reason ?? ''));

// 完成句4复习（明天练一次达标）
const later = new Date('2026-09-21T09:00:00');
store = { ...store, draft: { updatedAt: later.toISOString(), lastConflicts: [],
  items: [{ ...take(store, p4.id, v4.id, 96, 8), dateKey: dateKey(later), recordedAt: later.toISOString() }] } };
store = commitBatch(store, later).store;
const p4Fresh = store.phrases.find(p => p.id === p4.id)!;
ok('调度：复习完成', !store.reviews.some(r => r.versionId === v4.id && r.status === 'open'));
ok('门禁：最新 96 且无 open 复习，可以掌握', canMaster(store, p4Fresh).ok);

// --- 最新一次低于 85 也不能掌握
const p1 = store.phrases.find(p => p.id === 'phr_seed_1')!;
ok('门禁：句1 最新 90 分可掌握', canMaster(store, p1).ok);

// --- 修改句子：新版本；旧录音/分数归旧版本；旧复习归档；掌握重置
const v3 = store.versions.find(v => v.phraseId === 'phr_seed_3' && v.id === 'ver_seed_3_2')!;
const oldAttempts3 = store.attempts.filter(a => a.phraseId === 'phr_seed_3').length;
const edited = editPhrase(store, 'phr_seed_3', 'I appreciate your patience and thoughtful feedback today.', '新版译文', later);
const p3 = edited.phrases.find(p => p.id === 'phr_seed_3')!;
ok('改版：生成新版本并指向它', p3.currentVersionId !== v3.id);
ok('改版：掌握标记被重置', p3.mastered === false);
ok('改版：旧 attempt 数量不变（归旧版本）', edited.attempts.filter(a => a.phraseId === 'phr_seed_3').length === oldAttempts3);
const hist = versionHistory(edited, p3);
ok('改版：历史行保留旧版次数/最佳分', hist.some(r => r.attempts >= 1 && r.bestScore === 94));
ok('改版：新版本无记录，不能掌握', !canMaster(edited, p3).ok);

// --- 改版后旧 open 复习归档（句4 复习刚 done，这里构造一个 open 的再改版）
const withOpen: Store = { ...store, reviews: [...store.reviews, { ...rev4, status: 'open' }] };
const edited2 = editPhrase(withOpen, p4.id, 'New text for phrase four.', '译文', later);
ok('改版：旧版 open 复习 -> superseded',
  edited2.reviews.every(r => !(r.versionId === v4.id && r.status === 'open')) &&
  edited2.reviews.some(r => r.versionId === v4.id && r.status === 'superseded'));

// --- 用量统计
const u = dailyUsage(store, today);
ok('用量：今日统计包含已写入批次（7+20+10=37 秒，3 条）', u.sec === 37 && u.count === 3);

// --- 刷新一致性：JSON 往返后队列/批次/版本不变
const round: Store = JSON.parse(JSON.stringify(store));
ok('持久化：JSON 往返后队列一致', reviewQueue(round, today).map(r => r.id).join() === reviewQueue(store, today).map(r => r.id).join());
ok('持久化：批次一致', round.batches.length === store.batches.length);
ok('持久化：版本一致', round.versions.length === store.versions.length);

// --- 空批次提交
const empty = commitBatch({ ...store, draft: null }, now);
ok('空批次：无冲突也不写入', empty.conflicts.length === 0 && empty.store.attempts.length === store.attempts.length);

// --- 恰好不超限：句2 今日已 2 次，再 1 次 = 3，放行
const p2Count = usedCountToday(store, v2.id, today);
const edge: DraftItem[] = [take(store, p2.id, v2.id, 90, 5)];
const edgeStore: Store = { ...store, draft: { updatedAt: now.toISOString(), lastConflicts: [], items: edge } };
ok(`边界：已 ${p2Count} 次 + 1 = 3 恰好放行`, validateBatch(edgeStore, edge, today).filter(c => c.rule === 'PER_PHRASE_DAILY_LIMIT').length === 0);

console.log(`\n全部 ${passed} 项断言通过`);
void todayKey;
