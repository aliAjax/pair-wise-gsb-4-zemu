// 领域数据：句子的版本管理与初始种子。
// 版本规则：文本/译文修改追加新版本并切到新版本；仅标签、难度变化不产生新版本。旧版本与旧录音一律保留。

import type { DeskState, Level, Phrase, PhraseVersion, Review } from './types';
import { addDaysKey, dayKey } from './time';
import { id } from '../scheduler/scheduler';

export interface NewPhraseInput {
  text: string;
  translation: string;
  tag: string;
  level: Level;
}

export function makePhrase(input: NewPhraseInput, nowIso: string): Phrase {
  const v1: PhraseVersion = { id: id('ver'), n: 1, text: input.text, translation: input.translation, createdAt: nowIso };
  return {
    id: id('phrase'),
    tag: input.tag,
    level: input.level,
    versions: [v1],
    currentVersionId: v1.id,
    mastered: false,
    createdAt: nowIso,
  };
}

/** 修改句子：文本或译文变化 → 追加新版本，旧录音/分数留在旧版本；仅元数据变化 → 原地更新。 */
export function editPhrase(p: Phrase, input: NewPhraseInput, nowIso: string): Phrase {
  const current = p.versions.find(v => v.id === p.currentVersionId) ?? p.versions[p.versions.length - 1];
  const textChanged = input.text.trim() !== current.text || input.translation.trim() !== current.translation;
  if (!textChanged) return { ...p, tag: input.tag, level: input.level };
  const nv: PhraseVersion = {
    id: id('ver'),
    n: current.n + 1,
    text: input.text.trim(),
    translation: input.translation.trim(),
    createdAt: nowIso,
  };
  return { ...p, tag: input.tag, level: input.level, versions: [...p.versions, nv], currentVersionId: nv.id, mastered: false };
}

export function deletePhrase(state: DeskState, phraseId: string): DeskState {
  return {
    ...state,
    phrases: state.phrases.filter(p => p.id !== phraseId),
    attempts: state.attempts.filter(a => a.phraseId !== phraseId),
    reviews: state.reviews.filter(r => r.phraseId !== phraseId),
    drafts: state.drafts.filter(d => d.phraseId !== phraseId),
  };
}

export function seedState(): DeskState {
  const today = dayKey();
  const now = new Date();
  const iso = (dOffset: number, h: number, min: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dOffset);
    d.setHours(h, min, 0, 0);
    return d.toISOString();
  };

  const mkPhrase = (n: number, text: string, translation: string, tag: string, level: Level): Phrase => {
    const v1: PhraseVersion = { id: `seed_ver_${n}`, n: 1, text, translation, createdAt: iso(-6, 9, 0) };
    return { id: `seed_phrase_${n}`, tag, level, versions: [v1], currentVersionId: v1.id, mastered: false, createdAt: iso(-6, 9, 0) };
  };

  const p1 = mkPhrase(1, 'The morning light feels different today.', '今天的晨光感觉不一样。', '日常', '入门');
  const p2 = mkPhrase(2, 'Could you walk me through the next step?', '你能带我了解下一步吗？', '工作', '进阶');
  const p3 = mkPhrase(3, 'I appreciate your patience and thoughtful feedback.', '感谢你的耐心和细致反馈。', '表达', '挑战');
  const p4 = mkPhrase(4, "Let's make room for a little curiosity.", '给好奇心留一点空间。', '灵感', '入门');

  // p3 昨天练过并达标 → 已掌握（无 pending 复习）
  p3.mastered = true;
  p3.masteredAt = iso(-1, 18, 10);

  const a1 = {
    id: 'seed_attempt_1', phraseId: p3.id, versionId: p3.currentVersionId, versionN: 1,
    text: p3.versions[0].text, score: 92, wrongTags: [] as string[], durationSec: 118,
    at: iso(-1, 18, 10), dateKey: addDaysKey(today, -1), batchId: 'seed_batch_1',
  };
  // p2 昨天 78 分未达标 → 今天到期复习
  const a2 = {
    id: 'seed_attempt_2', phraseId: p2.id, versionId: p2.currentVersionId, versionN: 1,
    text: p2.versions[0].text, score: 78, wrongTags: ['词重音错位', '尾音吞音'], durationSec: 145,
    at: iso(-1, 20, 2), dateKey: addDaysKey(today, -1), batchId: 'seed_batch_2',
  };
  const r1: Review = {
    id: 'seed_review_1', phraseId: p2.id, versionId: p2.currentVersionId, versionN: 1,
    text: p2.versions[0].text, dueKey: today, status: 'pending',
    reason: '78 分（低于 85）安排次日复习', createdAt: iso(-1, 20, 2),
  };

  return {
    phrases: [p1, p2, p3, p4],
    attempts: [a1, a2],
    reviews: [r1],
    batches: [
      { id: 'seed_batch_1', at: iso(-1, 18, 10), dateKey: addDaysKey(today, -1), attemptIds: [a1.id], durationSec: 118 },
      { id: 'seed_batch_2', at: iso(-1, 20, 2), dateKey: addDaysKey(today, -1), attemptIds: [a2.id], durationSec: 145 },
    ],
    drafts: [],
  };
}
