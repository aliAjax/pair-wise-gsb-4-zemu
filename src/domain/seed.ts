// 初始示例数据（首次打开时写入，之后一切以本地存储为准）

import type { Attempt, BatchRecord, Phrase, ReviewTask, SentenceVersion, Store } from './types';
import { addDaysKey, todayKey, uid } from './util';

export function buildSeed(now = new Date()): Store {
  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  const twoDaysAgo = addDaysKey(today, -2);
  const iso = (key: string, hm: string) => new Date(`${key}T${hm}:00`).toISOString();

  const phrases: Phrase[] = [
    { id: 'phr_seed_1', currentVersionId: 'ver_seed_1_1', tag: '日常', level: '入门', mastered: false, createdAt: iso(twoDaysAgo, '09:00') },
    { id: 'phr_seed_2', currentVersionId: 'ver_seed_2_1', tag: '工作', level: '进阶', mastered: false, createdAt: iso(twoDaysAgo, '10:00') },
    { id: 'phr_seed_3', currentVersionId: 'ver_seed_3_2', tag: '表达', level: '挑战', mastered: true, createdAt: iso(twoDaysAgo, '11:00') },
    { id: 'phr_seed_4', currentVersionId: 'ver_seed_4_1', tag: '灵感', level: '入门', mastered: false, createdAt: iso(yesterday, '14:00') },
  ];

  const versions: SentenceVersion[] = [
    { id: 'ver_seed_1_1', phraseId: 'phr_seed_1', versionNo: 1, text: 'The morning light feels different today.', translation: '今天的晨光感觉不一样。', createdAt: iso(twoDaysAgo, '09:00') },
    { id: 'ver_seed_2_1', phraseId: 'phr_seed_2', versionNo: 1, text: 'Could you walk me through the next step?', translation: '你能带我了解下一步吗？', createdAt: iso(twoDaysAgo, '10:00') },
    { id: 'ver_seed_3_1', phraseId: 'phr_seed_3', versionNo: 1, text: 'I appreciate your patience.', translation: '感谢你的耐心。', createdAt: iso(twoDaysAgo, '11:00') },
    { id: 'ver_seed_3_2', phraseId: 'phr_seed_3', versionNo: 2, text: 'I appreciate your patience and thoughtful feedback.', translation: '感谢你的耐心和细致反馈。', createdAt: iso(yesterday, '16:30') },
    { id: 'ver_seed_4_1', phraseId: 'phr_seed_4', versionNo: 1, text: "Let's make room for a little curiosity.", translation: '给好奇心留一点空间。', createdAt: iso(yesterday, '14:00') },
  ];

  const mkAttempt = (
    id: string,
    batchId: string,
    phraseId: string,
    versionId: string,
    versionNo: number,
    phraseText: string,
    translation: string,
    score: number,
    wrongTags: string[],
    durationSec: number,
    recordedKey: string,
    hm: string,
  ): Attempt => ({
    id, batchId, phraseId, versionId, versionNo, phraseText, translation,
    score, wrongTags, durationSec,
    recordedAt: iso(recordedKey, hm),
    dateKey: recordedKey,
  });

  const batches: BatchRecord[] = [
    {
      id: 'bat_seed_1', committedAt: iso(twoDaysAgo, '09:40'), dateKey: twoDaysAgo,
      itemCount: 2, totalSec: 14, attemptIds: ['att_seed_1', 'att_seed_2'],
    },
    {
      id: 'bat_seed_2', committedAt: iso(yesterday, '17:00'), dateKey: yesterday,
      itemCount: 3, totalSec: 24, attemptIds: ['att_seed_3', 'att_seed_4', 'att_seed_5'],
    },
    {
      id: 'bat_seed_3', committedAt: iso(today, '09:30'), dateKey: today,
      itemCount: 1, totalSec: 7, attemptIds: ['att_seed_6'],
    },
  ];

  const attempts: Attempt[] = [
    // 句1：前天 82（安排复习，昨天到期），昨天 90 完成复习
    mkAttempt('att_seed_1', 'bat_seed_1', 'phr_seed_1', 'ver_seed_1_1', 1,
      'The morning light feels different today.', '今天的晨光感觉不一样。', 82, ['th', 'stress'], 8, twoDaysAgo, '09:38'),
    mkAttempt('att_seed_2', 'bat_seed_1', 'phr_seed_2', 'ver_seed_2_1', 1,
      'Could you walk me through the next step?', '你能带我了解下一步吗？', 76, ['liaison', 'intonation', 'ending'], 6, twoDaysAgo, '09:39'),
    mkAttempt('att_seed_3', 'bat_seed_2', 'phr_seed_1', 'ver_seed_1_1', 1,
      'The morning light feels different today.', '今天的晨光感觉不一样。', 90, ['th'], 9, yesterday, '16:58'),
    // 句3 旧版本 v1：昨天早上 88，后来句子改版 -> 复习被 v2 取代
    mkAttempt('att_seed_4', 'bat_seed_2', 'phr_seed_3', 'ver_seed_3_1', 1,
      'I appreciate your patience.', '感谢你的耐心。', 88, ['schwa'], 7, yesterday, '16:59'),
    mkAttempt('att_seed_5', 'bat_seed_2', 'phr_seed_3', 'ver_seed_3_2', 2,
      'I appreciate your patience and thoughtful feedback.', '感谢你的耐心和细致反馈。', 94, [], 8, yesterday, '17:00'),
    // 今天：句2 又练 78 -> 明天复习（队列里可见）
    mkAttempt('att_seed_6', 'bat_seed_3', 'phr_seed_2', 'ver_seed_2_1', 1,
      'Could you walk me through the next step?', '你能带我了解下一步吗？', 78, ['liaison', 'ending'], 7, today, '09:30'),
  ];

  const reviews: ReviewTask[] = [
    {
      id: 'rev_seed_1', phraseId: 'phr_seed_1', versionId: 'ver_seed_1_1', versionNo: 1,
      phraseText: 'The morning light feels different today.',
      dueKey: yesterday, causeScore: 82, causedByAttemptId: 'att_seed_1',
      createdAt: iso(twoDaysAgo, '09:40'), status: 'done',
      completedAt: iso(yesterday, '16:58'), completedByBatchId: 'bat_seed_2',
    },
    {
      id: 'rev_seed_2', phraseId: 'phr_seed_2', versionId: 'ver_seed_2_1', versionNo: 1,
      phraseText: 'Could you walk me through the next step?',
      dueKey: today, causeScore: 76, causedByAttemptId: 'att_seed_2',
      createdAt: iso(twoDaysAgo, '09:40'), status: 'open', // 昨天 76 排今天，今天又 78，到期日顺延到明天
    },
    {
      id: 'rev_seed_3', phraseId: 'phr_seed_3', versionId: 'ver_seed_3_1', versionNo: 1,
      phraseText: 'I appreciate your patience.',
      dueKey: yesterday, causeScore: 88, causedByAttemptId: 'att_seed_4',
      createdAt: iso(yesterday, '17:00'), status: 'superseded',
    },
  ];
  // rev_seed_2 的 dueKey 今天又被 78 顺延
  reviews[1].dueKey = addDaysKey(today, 1);
  reviews[1].causeScore = 78;
  reviews[1].causedByAttemptId = 'att_seed_6';

  void uid;
  return { version: 1, phrases, versions, attempts, reviews, batches, draft: null };
}
