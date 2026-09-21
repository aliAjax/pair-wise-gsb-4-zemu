// 调度层：全部为纯函数，不依赖 React / localStorage。
// 规则（与页面、持久化解耦，便于单独校验）：
//  1. 同一句每天最多 3 次；当天总用时不超过 20 分钟。按“已写入 + 本批草稿”合计计算。
//  2. 任一项超限，整批拒绝写入，草稿原样保留，并逐条列出冲突：句子 / 次数 / 原值 / 规则。
//  3. 机器分 < 85：该句安排次日复习（已有 pending 则顺延到次日），完成前不能标已掌握；≥85 完成到期复习。
//  4. 修改句子产生新版本；录音与分数绑定版本；复习队列展示触发复习时的版本快照，用当前版本录音即可完成，避免改句后复习死锁。

import type { Attempt, Batch, Conflict, DeskState, DraftItem, Phrase, Review } from '../domain/types';
import { addDaysKey } from '../domain/time';

export const DAILY_PER_PHRASE_LIMIT = 3;
export const DAILY_TIME_CAP_SEC = 20 * 60;
export const MASTER_SCORE = 85;

export function id(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface CommitStats {
  committedSecToday: number;
  projectedSecToday: number;
  perPhraseToday: Map<string, number>;
}

/** 已写入的今日用时。 */
export function committedSecToday(state: Pick<DeskState, 'attempts'>, today: string): number {
  return state.attempts.filter(a => a.dateKey === today).reduce((s, a) => s + a.durationSec, 0);
}

/** 每条草稿单独（连同已写入）计算，这样冲突行的“次数”就是该句提交后的今日次数。 */
export function checkDraftConflicts(
  state: Pick<DeskState, 'attempts' | 'drafts'>,
  draft: DraftItem,
  today: string,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const committedPhrase = state.attempts.filter(a => a.dateKey === today && a.phraseId === draft.phraseId).length;
  const otherDrafts = state.drafts.filter(d => d.id !== draft.id && d.phraseId === draft.phraseId).length;
  const count = committedPhrase + otherDrafts + 1;
  if (count > DAILY_PER_PHRASE_LIMIT) {
    conflicts.push({
      id: `phrase_${draft.id}`,
      rule: 'PER_PHRASE_DAILY_LIMIT',
      phraseId: draft.phraseId,
      text: draft.text,
      count,
      original: `已写入 ${committedPhrase} 次 · 批次 ${otherDrafts + 1} 次 · 上限 ${DAILY_PER_PHRASE_LIMIT} 次/句/天`,
    });
  }
  const committedSec = committedSecToday(state, today);
  const batchSec = state.drafts.filter(d => d.id !== draft.id).reduce((s, d) => s + d.durationSec, 0) + draft.durationSec;
  const total = committedSec + batchSec;
  if (total > DAILY_TIME_CAP_SEC) {
    conflicts.push({
      id: `time_${draft.id}`,
      rule: 'DAILY_TIME_CAP',
      phraseId: draft.phraseId,
      text: draft.text,
      count: total,
      original: `已写入 ${committedSec} 秒 · 本批 ${batchSec} 秒 · 合计 ${total} 秒 · 上限 ${DAILY_TIME_CAP_SEC} 秒/天`,
    });
  }
  return conflicts;
}

export function batchConflicts(state: Pick<DeskState, 'attempts' | 'drafts'>, today: string): Conflict[] {
  return state.drafts.flatMap(d => checkDraftConflicts(state, d, today));
}

/** 一次原子提交：冲突存在则拒绝（返回 null）；否则草稿整体转为 Attempt + Batch，并推进复习。 */
export function commitDraftBatch(state: DeskState, today: string, nowIso: string): DeskState | null {
  if (state.drafts.length === 0) return null;
  if (batchConflicts(state, today).length > 0) return null;

  const ordered = [...state.drafts].sort((a, b) => a.at.localeCompare(b.at));
  const batchId = id('batch');
  const attempts: Attempt[] = ordered.map(d => ({
    id: id('attempt'),
    phraseId: d.phraseId,
    versionId: d.versionId,
    versionN: d.versionN,
    text: d.text,
    score: d.score,
    wrongTags: d.wrongTags,
    durationSec: d.durationSec,
    at: d.at,
    dateKey: today,
    batchId,
  }));
  const batch: Batch = {
    id: batchId,
    at: nowIso,
    dateKey: today,
    attemptIds: attempts.map(a => a.id),
    durationSec: attempts.reduce((s, a) => s + a.durationSec, 0),
  };

  let reviews = state.reviews.map(r => ({ ...r }));
  let phrases = state.phrases.map(p => ({ ...p }));
  for (const d of ordered) {
    const phrase = phrases.find(p => p.id === d.phraseId);
    if (d.score < MASTER_SCORE) {
      // 低于 85：安排次日复习（已存在的 pending 顺延到明天，保持每句至多一条 pending）。
      const existing = reviews.find(r => r.phraseId === d.phraseId && r.status === 'pending');
      if (existing) {
        existing.versionId = d.versionId;
        existing.versionN = d.versionN;
        existing.text = d.text;
        existing.dueKey = addDaysKey(today, 1);
        existing.reason = `${d.score} 分（低于 ${MASTER_SCORE}）复习未通过，顺延至次日`;
        existing.createdAt = d.at;
      } else {
        reviews.push({
          id: id('review'),
          phraseId: d.phraseId,
          versionId: d.versionId,
          versionN: d.versionN,
          text: d.text,
          dueKey: addDaysKey(today, 1),
          status: 'pending',
          reason: `${d.score} 分（低于 ${MASTER_SCORE}）安排次日复习`,
          createdAt: d.at,
        });
      }
      if (phrase) phrase.mastered = false;
    } else {
      // ≥85：完成该句所有已到期（含逾期）的 pending 复习；未来到期的保留。
      for (const r of reviews) {
        if (r.phraseId === d.phraseId && r.status === 'pending' && r.dueKey <= today) {
          r.status = 'done';
          r.completedAt = nowIso;
          r.completedByAttemptId = attempts.find(a => a.phraseId === d.phraseId)?.id;
        }
      }
    }
  }

  return {
    ...state,
    phrases,
    attempts: [...state.attempts, ...attempts],
    reviews,
    batches: [...state.batches, batch],
    drafts: [],
    lastCommit: { at: nowIso, ok: true, count: attempts.length },
  };
}

export function currentVersion(p: Phrase): Phrase['versions'][number] {
  return p.versions.find(v => v.id === p.currentVersionId) ?? p.versions[p.versions.length - 1];
}

/** 掌握条件：当前版本有达标（≥85）录音，且没有未完成的复习。旧版本分数归旧版本，改句后需在新版本重新达标。 */
export function canMaster(state: Pick<DeskState, 'attempts' | 'reviews' | 'phrases'>, phraseId: string, today: string): { ok: boolean; reason: string } {
  const open = state.reviews.filter(r => r.phraseId === phraseId && r.status === 'pending');
  const dueOpen = open.filter(r => r.dueKey <= today);
  if (dueOpen.length > 0) return { ok: false, reason: '还有到期复习未完成' };
  if (open.length > 0) return { ok: false, reason: '已有次日复习安排' };
  const phrase = state.phrases.find(p => p.id === phraseId);
  if (!phrase) return { ok: false, reason: '句子不存在' };
  const passed = state.attempts.some(
    a => a.phraseId === phraseId && a.versionId === phrase.currentVersionId && a.score >= MASTER_SCORE,
  );
  if (!passed) return { ok: false, reason: `当前版本尚无 ≥${MASTER_SCORE} 分的录音` };
  return { ok: true, reason: `当前版本已有达标录音，复习已清零` };
}

export function openReviews(state: Pick<DeskState, 'reviews'>, today: string): Review[] {
  return state.reviews
    .filter(r => r.status === 'pending')
    .sort((a, b) => a.dueKey.localeCompare(b.dueKey));
}

export function phraseAttempts(state: Pick<DeskState, 'attempts'>, phraseId: string): Attempt[] {
  return state.attempts.filter(a => a.phraseId === phraseId).sort((a, b) => b.at.localeCompare(a.at));
}
