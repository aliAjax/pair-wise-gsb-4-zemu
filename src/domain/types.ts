// 领域数据：离线复习调度台的核心数据结构。
// 设计要点：
// - 句子（Phrase）有版本（PhraseVersion）流；录音分数（Attempt）永远绑定录音时的版本，改句子不改写旧记录。
// - 复习（Review）挂在句子上，只保留一条 pending（失败即续到次日），队列里展示的是触发复习时的旧版本快照。
// - 一次录音先进入草稿（DraftItem），同一批草稿校验通过后原子写入为 Attempt + Batch；超限则整批保留为草稿。

export type Level = '入门' | '进阶' | '挑战';

export interface PhraseVersion {
  id: string;
  n: number; // 版本号，从 1 开始
  text: string;
  translation: string;
  createdAt: string;
}

export interface Phrase {
  id: string;
  tag: string;
  level: Level;
  versions: PhraseVersion[];
  currentVersionId: string;
  mastered: boolean;
  masteredAt?: string;
  createdAt: string;
}

export interface Attempt {
  id: string;
  phraseId: string;
  versionId: string; // 录音时的版本（旧录音、旧分数归旧版本）
  versionN: number;
  text: string; // 版本文本快照
  score: number; // 机器分 0–100
  wrongTags: string[]; // 错音标签
  durationSec: number; // 用时（秒）
  at: string;
  dateKey: string; // 本地日期桶
  batchId: string; // 所属写入批次
}

export interface Review {
  id: string;
  phraseId: string;
  versionId: string; // 触发复习时的版本（队列展示旧文本快照）
  versionN: number;
  text: string;
  dueKey: string; // 到期日期桶
  status: 'pending' | 'done';
  reason: string;
  createdAt: string;
  completedAt?: string;
  completedByAttemptId?: string;
}

export interface Batch {
  id: string;
  at: string;
  dateKey: string;
  attemptIds: string[];
  durationSec: number;
}

export interface DraftItem {
  id: string;
  phraseId: string;
  versionId: string;
  versionN: number;
  text: string;
  score: number;
  wrongTags: string[];
  durationSec: number;
  at: string;
}

export type ConflictRule = 'PER_PHRASE_DAILY_LIMIT' | 'DAILY_TIME_CAP';

export interface Conflict {
  id: string;
  rule: ConflictRule;
  phraseId: string;
  text: string; // 句子
  count: number; // 次数（提交后该句今日次数）
  original: string; // 原值（已写入值 / 本批值 / 合计值）
}

export interface CommitResult {
  at: string;
  ok: boolean;
  count: number;
}

export interface DeskState {
  phrases: Phrase[];
  attempts: Attempt[];
  reviews: Review[];
  batches: Batch[];
  drafts: DraftItem[];
  lastCommit?: CommitResult;
}
