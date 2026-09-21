// 领域层：纯数据类型，不依赖 React / 浏览器 API

export type Level = '入门' | '进阶' | '挑战';

export const RULE_CODE = {
  PER_PHRASE_DAILY_LIMIT: 'PER_PHRASE_DAILY_LIMIT',
  DAILY_TIME_CAP: 'DAILY_TIME_CAP',
} as const;
export type RuleCode = (typeof RULE_CODE)[keyof typeof RULE_CODE];

/** 句子实体：文本可改版，实体本身稳定 */
export interface Phrase {
  id: string;
  currentVersionId: string;
  tag: string;
  level: Level;
  mastered: boolean;
  createdAt: string;
}

/** 句子版本：文本一经写入不可变；修改句子 = 新增版本 */
export interface SentenceVersion {
  id: string;
  phraseId: string;
  versionNo: number; // 从 1 开始
  text: string;
  translation: string;
  createdAt: string;
}

/** 一次已提交的练习（归属于提交时的句子版本） */
export interface Attempt {
  id: string;
  batchId: string;
  phraseId: string;
  versionId: string;
  versionNo: number;
  phraseText: string; // 快照
  translation: string; // 快照
  score: number; // 机器分 0-100
  wrongTags: string[]; // 错音标签 code
  durationSec: number; // 用时（秒）
  recordedAt: string; // ISO
  dateKey: string; // 练习当地日期 YYYY-MM-DD
  audioId?: string; // IndexedDB 中的录音键，无录音（模拟模式）时缺省
}

export type ReviewStatus = 'open' | 'done' | 'superseded';

/** 复习任务：机器分 < 85 的次日复习 */
export interface ReviewTask {
  id: string;
  phraseId: string;
  versionId: string;
  versionNo: number;
  phraseText: string;
  dueKey: string; // 到期日 YYYY-MM-DD
  causeScore: number;
  causedByAttemptId: string;
  createdAt: string;
  status: ReviewStatus;
  completedAt?: string;
  completedByBatchId?: string;
}

/** 已提交批次（一次整批写入） */
export interface BatchRecord {
  id: string;
  committedAt: string;
  dateKey: string;
  itemCount: number;
  totalSec: number;
  attemptIds: string[];
}

/** 草稿条目：尚未提交的单次练习 */
export interface DraftItem {
  id: string;
  phraseId: string;
  versionId: string;
  versionNo: number;
  phraseText: string;
  translation: string;
  score: number;
  wrongTags: string[];
  durationSec: number;
  recordedAt: string;
  dateKey: string;
  audioId?: string;
}

/** 批次草稿：校验失败也保留，冲突随草稿持久化 */
export interface Draft {
  updatedAt: string;
  items: DraftItem[];
  lastConflicts: Conflict[];
}

export interface MetricLimit {
  base: number; // 原值：今日已写入
  add: number; // 本批新增
  result: number; // 合并后
  limit: number; // 规则上限
}

/** 冲突行：句子、次数、原值、规则（用时冲突同时给秒数） */
export interface Conflict {
  rule: RuleCode;
  ruleText: string;
  phraseId?: string;
  phraseText: string; // 时间上限行用「全部句子」
  versionNo?: number;
  counts?: MetricLimit;
  seconds?: MetricLimit;
}

export interface Store {
  version: 1;
  phrases: Phrase[];
  versions: SentenceVersion[];
  attempts: Attempt[];
  reviews: ReviewTask[];
  batches: BatchRecord[];
  draft: Draft | null;
}
