// 领域规则常量 + 离线机器评分（本地模拟，不联网）

export const PASS_SCORE = 85; // 达标分
export const PER_PHRASE_LIMIT = 3; // 同一句每天最多三次
export const DAILY_CAP_SEC = 20 * 60; // 当天总用时上限 20 分钟

export const RULE_TEXT = {
  PER_PHRASE_DAILY_LIMIT: `同一句每天最多 ${PER_PHRASE_LIMIT} 次`,
  DAILY_TIME_CAP: `当天总用时不超过 ${DAILY_CAP_SEC / 60} 分钟`,
} as const;

export interface WrongTagDef {
  code: string;
  label: string;
}

export const WRONG_TAGS: WrongTagDef[] = [
  { code: 'th', label: 'th 咬舌音' },
  { code: 'ae', label: 'æ 开口度' },
  { code: 'stress', label: '重音偏移' },
  { code: 'ending', label: '词尾辅音吞音' },
  { code: 'liaison', label: '连读断裂' },
  { code: 'intonation', label: '句调平直' },
  { code: 'longshort', label: '长短音不分' },
  { code: 'schwa', label: '弱读央元音' },
];

export function tagLabel(code: string): string {
  return WRONG_TAGS.find(t => t.code === code)?.label ?? code;
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 离线机器评分：根据本次录音模拟分数与错音标签。
 * 约 1/3 概率低于 85，以便真实触发复习调度。
 */
export function scoreTake(): { score: number; wrongTags: string[] } {
  const roll = Math.random();
  const score =
    roll < 0.32
      ? 60 + Math.floor(Math.random() * 25) // 60-84：需次日复习
      : 85 + Math.floor(Math.random() * 14); // 85-98：达标
  const want = score >= 93 ? (Math.random() < 0.6 ? 0 : 1) : score >= 85 ? 1 : 2 + (Math.random() < 0.4 ? 1 : 0);
  return { score, wrongTags: shuffle(WRONG_TAGS).slice(0, want).map(t => t.code) };
}
