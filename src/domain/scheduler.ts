// 调度层：纯函数。校验、提交、复习队列、版本规则，全部不触碰存储与 React。

import { DAILY_CAP_SEC, PASS_SCORE, PER_PHRASE_LIMIT, RULE_TEXT } from './rules';
import type {
  Attempt,
  Conflict,
  DraftItem,
  MetricLimit,
  Phrase,
  ReviewTask,
  SentenceVersion,
  Store,
} from './types';
import { addDaysKey, dateKey, todayKey, uid } from './util';

export function versionOf(store: Store, versionId: string): SentenceVersion | undefined {
  return store.versions.find(v => v.id === versionId);
}

export function phraseVersions(store: Store, phraseId: string): SentenceVersion[] {
  return store.versions
    .filter(v => v.phraseId === phraseId)
    .sort((a, b) => a.versionNo - b.versionNo);
}

export function currentVersion(store: Store, phraseId: string): SentenceVersion | undefined {
  const p = store.phrases.find(x => x.id === phraseId);
  return p ? versionOf(store, p.currentVersionId) : undefined;
}

export function attemptsFor(store: Store, versionId: string): Attempt[] {
  return store.attempts.filter(a => a.versionId === versionId);
}

/** 今日某版本已写入次数（草稿不算已写入） */
export function usedCountToday(store: Store, versionId: string, day = todayKey()): number {
  return store.attempts.filter(a => a.versionId === versionId && a.dateKey === day).length;
}

export function usedSecondsToday(store: Store, day = todayKey()): number {
  return store.attempts.filter(a => a.dateKey === day).reduce((s, a) => s + a.durationSec, 0);
}

export function draftCountFor(items: DraftItem[], versionId: string): number {
  return items.filter(i => i.versionId === versionId).length;
}

function metric(base: number, add: number, limit: number): MetricLimit {
  return { base, add, result: base + add, limit };
}

/**
 * 批次校验（all-or-nothing）：
 * 规则一：同一句（按版本）每天最多 3 次 —— 已写入 + 本批合并
 * 规则二：当天总用时 ≤ 20 分钟 —— 已写入 + 本批合计
 * 超限：整批不写入，草稿保留，逐条列出冲突
 */
export function validateBatch(store: Store, items: DraftItem[], day = todayKey()): Conflict[] {
  const conflicts: Conflict[] = [];
  if (items.length === 0) return conflicts;

  // 规则一：按版本汇总
  const byVersion = new Map<string, DraftItem[]>();
  for (const it of items) {
    const arr = byVersion.get(it.versionId) ?? [];
    arr.push(it);
    byVersion.set(it.versionId, arr);
  }
  for (const [versionId, group] of byVersion) {
    const base = usedCountToday(store, versionId, day);
    const add = group.length;
    if (base + add > PER_PHRASE_LIMIT) {
      const first = group[0];
      conflicts.push({
        rule: 'PER_PHRASE_DAILY_LIMIT',
        ruleText: RULE_TEXT.PER_PHRASE_DAILY_LIMIT,
        phraseId: first.phraseId,
        phraseText: first.phraseText,
        versionNo: first.versionNo,
        counts: metric(base, add, PER_PHRASE_LIMIT),
      });
    }
  }

  // 规则二：总用时
  const baseSec = usedSecondsToday(store, day);
  const addSec = items.reduce((s, i) => s + i.durationSec, 0);
  if (baseSec + addSec > DAILY_CAP_SEC) {
    conflicts.push({
      rule: 'DAILY_TIME_CAP',
      ruleText: RULE_TEXT.DAILY_TIME_CAP,
      phraseText: '全部句子',
      seconds: metric(baseSec, addSec, DAILY_CAP_SEC),
    });
  }

  return conflicts;
}

export interface CommitResult {
  store: Store;
  conflicts: Conflict[];
}

/**
 * 整批提交。有任意冲突：不写入（调用方负责保留草稿并记录冲突）。
 * 成功：写入 attempts / batch；按机器分安排或完成复习；
 *       低于 85 的版本不得保持「已掌握」。
 */
export function commitBatch(store: Store, now = new Date()): CommitResult {
  const items = store.draft?.items ?? [];
  const day = dateKey(now);
  const conflicts = validateBatch(store, items, day);
  if (conflicts.length > 0 || items.length === 0) {
    return { store, conflicts: items.length === 0 ? [] : conflicts };
  }

  const batchId = uid('bat');
  const attempts: Attempt[] = items.map(i => ({
    id: uid('att'),
    batchId,
    phraseId: i.phraseId,
    versionId: i.versionId,
    versionNo: i.versionNo,
    phraseText: i.phraseText,
    translation: i.translation,
    score: i.score,
    wrongTags: i.wrongTags,
    durationSec: i.durationSec,
    recordedAt: i.recordedAt,
    dateKey: i.dateKey,
    audioId: i.audioId,
  }));

  const reviews: ReviewTask[] = [...store.reviews];
  const newReviewIds = new Set<string>();
  const passByVersion = new Map<string, boolean>();
  for (const a of attempts) passByVersion.set(a.versionId, a.score >= PASS_SCORE);

  for (const a of attempts) {
    const open = reviews.find(
      r => r.versionId === a.versionId && r.status === 'open',
    );
    if (a.score < PASS_SCORE) {
      // 安排次日复习（同日同一版本只保留一条 open，顺延到期日）
      const due = addDaysKey(a.dateKey, 1);
      if (open) {
        if (due > open.dueKey) open.dueKey = due;
        open.causeScore = Math.min(open.causeScore, a.score);
      } else {
        const r: ReviewTask = {
          id: uid('rev'),
          phraseId: a.phraseId,
          versionId: a.versionId,
          versionNo: a.versionNo,
          phraseText: a.phraseText,
          dueKey: due,
          causeScore: a.score,
          causedByAttemptId: a.id,
          createdAt: now.toISOString(),
          status: 'open',
        };
        reviews.push(r);
        newReviewIds.add(r.id);
      }
    } else if (open) {
      // 达标练习完成待复习
      open.status = 'done';
      open.completedAt = now.toISOString();
      open.completedByBatchId = batchId;
    }
  }

  // 达标分以下不能标已掌握：回退标记
  const phrases = store.phrases.map(p => {
    const v = passByVersion.get(p.currentVersionId);
    return v === false && p.mastered ? { ...p, mastered: false } : p;
  });

  const batchRecord = {
    id: batchId,
    committedAt: now.toISOString(),
    dateKey: day,
    itemCount: attempts.length,
    totalSec: attempts.reduce((s, a) => s + a.durationSec, 0),
    attemptIds: attempts.map(a => a.id),
  };

  const next: Store = {
    ...store,
    phrases,
    attempts: [...store.attempts, ...attempts],
    reviews,
    batches: [...store.batches, batchRecord],
    draft: null, // 整批成功后草稿清空
  };
  return { store: next, conflicts: [] };
}

/** 当前版本是否允许标为已掌握：有待复习未完成，或最新一次低于 85，均禁止 */
export function canMaster(store: Store, phrase: Phrase): { ok: boolean; reason?: string } {
  const hasOpenReview = store.reviews.some(
    r => r.versionId === phrase.currentVersionId && r.status === 'open',
  );
  if (hasOpenReview) return { ok: false, reason: '该句有次日复习尚未完成' };
  const latest = [...store.attempts]
    .filter(a => a.versionId === phrase.currentVersionId)
    .sort((x, y) => (x.recordedAt < y.recordedAt ? 1 : -1))[0];
  if (!latest) return { ok: false, reason: '还没有完成过该版本的练习' };
  if (latest.score < PASS_SCORE) return { ok: false, reason: `最近一次机器分 ${latest.score}，低于 ${PASS_SCORE} 分` };
  return { ok: true };
}

export interface QueueRow extends ReviewTask {
  overdue: boolean;
}

/** 复习队列：open 任务，逾期优先、其次按到期日 */
export function reviewQueue(store: Store, day = todayKey()): QueueRow[] {
  return store.reviews
    .filter(r => r.status === 'open')
    .map(r => ({ ...r, overdue: r.dueKey < day }))
    .sort((a, b) => (a.dueKey < b.dueKey ? -1 : a.dueKey > b.dueKey ? 1 : 0));
}

/** 历史版本（不含当前版本），带每版本练习次数与复习数 */
export interface VersionHistoryRow extends SentenceVersion {
  attempts: number;
  bestScore: number | null;
  openReviews: number;
  supersededReviews: number;
}

export function versionHistory(store: Store, phrase: Phrase): VersionHistoryRow[] {
  return phraseVersions(store, phrase.id)
    .filter(v => v.id !== phrase.currentVersionId)
    .map(v => {
      const att = store.attempts.filter(a => a.versionId === v.id);
      return {
        ...v,
        attempts: att.length,
        bestScore: att.length ? Math.max(...att.map(a => a.score)) : null,
        openReviews: store.reviews.filter(r => r.versionId === v.id && r.status === 'open').length,
        supersededReviews: store.reviews.filter(
          r => r.versionId === v.id && r.status === 'superseded',
        ).length,
      };
    });
}

/**
 * 修改句子 = 为实体新增版本（旧版本不可变，旧录音/分数仍归旧版本）。
 * 旧版本未完成复习一律归为 superseded，已掌握标记重置（新版本须重新达标）。
 */
export function editPhrase(
  store: Store,
  phraseId: string,
  text: string,
  translation: string,
  now = new Date(),
): Store {
  const phrase = store.phrases.find(p => p.id === phraseId);
  if (!phrase) return store;
  const oldVersions = phraseVersions(store, phraseId);
  const newVersion: SentenceVersion = {
    id: uid('ver'),
    phraseId,
    versionNo: oldVersions.length + 1,
    text,
    translation,
    createdAt: now.toISOString(),
  };
  const reviews = store.reviews.map(r =>
    r.phraseId === phraseId && r.status === 'open'
      ? { ...r, status: 'superseded' as const }
      : r,
  );
  return {
    ...store,
    versions: [...store.versions, newVersion],
    phrases: store.phrases.map(p =>
      p.id === phraseId ? { ...p, currentVersionId: newVersion.id, mastered: false } : p,
    ),
    reviews,
  };
}

export function addPhrase(
  store: Store,
  text: string,
  translation: string,
  tag: string,
  level: Phrase['level'],
  now = new Date(),
): { store: Store; phraseId: string } {
  const id = uid('phr');
  const version: SentenceVersion = {
    id: uid('ver'),
    phraseId: id,
    versionNo: 1,
    text,
    translation,
    createdAt: now.toISOString(),
  };
  const phrase: Phrase = {
    id,
    currentVersionId: version.id,
    tag,
    level,
    mastered: false,
    createdAt: now.toISOString(),
  };
  return {
    store: { ...store, phrases: [...store.phrases, phrase], versions: [...store.versions, version] },
    phraseId: id,
  };
}

/** 仅允许删除从未练习过的句子（已有分数/录音归历史，不静默丢失） */
export function canDeletePhrase(store: Store, phraseId: string): boolean {
  return !store.attempts.some(a => a.phraseId === phraseId);
}

export function deletePhrase(store: Store, phraseId: string): Store {
  if (!canDeletePhrase(store, phraseId)) return store;
  return {
    ...store,
    phrases: store.phrases.filter(p => p.id !== phraseId),
    versions: store.versions.filter(v => v.phraseId !== phraseId),
  };
}

export function latestAttempt(store: Store, versionId: string): Attempt | undefined {
  return [...store.attempts]
    .filter(a => a.versionId === versionId)
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
}

export function bestScore(store: Store, versionId: string): number | null {
  const scores = store.attempts.filter(a => a.versionId === versionId).map(a => a.score);
  return scores.length ? Math.max(...scores) : null;
}

/** 今日额度摘要（仅统计已写入；草稿在提交时参与合并校验） */
export function dailyUsage(store: Store, day = todayKey()) {
  const todays = store.attempts.filter(a => a.dateKey === day);
  return {
    sec: todays.reduce((s, a) => s + a.durationSec, 0),
    count: todays.length,
    lowCount: todays.filter(a => a.score < PASS_SCORE).length,
    capSec: DAILY_CAP_SEC,
  };
}
