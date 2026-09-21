// 状态层：reducer + localStorage 持久化。领域结构与调度规则来自 domain/scheduler，这里只做装配与读写。

import { useEffect, useReducer } from 'react';
import type { DeskState, DraftItem, Phrase } from '../domain/types';
import { dayKey } from '../domain/time';
import { deletePhrase, editPhrase, makePhrase, seedState, type NewPhraseInput } from '../domain/model';
import {
  batchConflicts,
  canMaster,
  commitDraftBatch,
  committedSecToday,
  currentVersion,
  id,
} from '../scheduler/scheduler';

const STORAGE_KEY = 'voice-review-desk:v1';

export type DeskAction =
  | { type: 'ADD_PHRASE'; input: NewPhraseInput }
  | { type: 'EDIT_PHRASE'; phraseId: string; input: NewPhraseInput }
  | { type: 'DELETE_PHRASE'; phraseId: string }
  | { type: 'MARK_MASTERED'; phraseId: string }
  | { type: 'ADD_DRAFT'; draft: Omit<DraftItem, 'id'> }
  | { type: 'REMOVE_DRAFT'; draftId: string }
  | { type: 'CLEAR_DRAFTS' }
  | { type: 'COMMIT_BATCH' }
  | { type: 'CLEAR_LAST_COMMIT' }
  | { type: 'RESET' };

export function reducer(state: DeskState, action: DeskAction): DeskState {
  const nowIso = new Date().toISOString();
  const today = dayKey();
  switch (action.type) {
    case 'ADD_PHRASE': {
      const phrase = makePhrase(action.input, nowIso);
      return { ...state, phrases: [...state.phrases, phrase] };
    }
    case 'EDIT_PHRASE': {
      return {
        ...state,
        phrases: state.phrases.map(p => (p.id === action.phraseId ? editPhrase(p, action.input, nowIso) : p)),
      };
    }
    case 'DELETE_PHRASE':
      return deletePhrase(state, action.phraseId);
    case 'MARK_MASTERED': {
      if (!canMaster(state, action.phraseId, today).ok) return state; // 有复习未完成时禁止
      return {
        ...state,
        phrases: state.phrases.map(p =>
          p.id === action.phraseId ? { ...p, mastered: true, masteredAt: nowIso } : p,
        ),
      };
    }
    case 'ADD_DRAFT': {
      const draft: DraftItem = { ...action.draft, id: id('draft') };
      return { ...state, drafts: [...state.drafts, draft] };
    }
    case 'REMOVE_DRAFT':
      return { ...state, drafts: state.drafts.filter(d => d.id !== action.draftId) };
    case 'CLEAR_DRAFTS':
      return { ...state, drafts: [] };
    case 'COMMIT_BATCH': {
      const next = commitDraftBatch(state, today, nowIso);
      // 超限时整批不写入：状态不变（草稿保留），仅记录一次失败结果用于页面提示。
      return next ?? { ...state, lastCommit: { at: nowIso, ok: false, count: state.drafts.length } };
    }
    case 'CLEAR_LAST_COMMIT':
      return { ...state, lastCommit: undefined };
    case 'RESET':
      localStorage.removeItem(STORAGE_KEY);
      return seedFresh();
    default:
      return state;
  }
}

export function seedFresh(): DeskState {
  return seedState();
}

function load(): DeskState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeskState;
      if (Array.isArray(parsed.phrases) && Array.isArray(parsed.attempts)) return parsed;
    }
  } catch {
    // 存储损坏时回退到种子
  }
  return seedState();
}

export interface DeskStore {
  state: DeskState;
  today: string;
  dispatch: React.Dispatch<DeskAction>;
}

export function useDesk(): DeskStore {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  return { state, today: dayKey(), dispatch };
}

// —— 选择器（派生数据集中在此，页面不直接算规则）——

export function selectTodayAttempts(state: DeskState, today: string) {
  return state.attempts.filter(a => a.dateKey === today);
}

export function selectPhraseTodayCount(state: DeskState, phraseId: string, today: string): number {
  return state.attempts.filter(a => a.dateKey === today && a.phraseId === phraseId).length;
}

export function selectDraftCountForPhrase(state: DeskState, phraseId: string): number {
  return state.drafts.filter(d => d.phraseId === phraseId).length;
}

export function selectConflicts(state: DeskState, today: string) {
  return batchConflicts(state, today);
}

export function selectCommittedSecToday(state: DeskState, today: string): number {
  return committedSecToday(state, today);
}

export function selectCurrentPhrase(state: DeskState, phraseId: string | undefined): Phrase | undefined {
  return state.phrases.find(p => p.id === phraseId) ?? state.phrases[0];
}

export { canMaster, currentVersion };
