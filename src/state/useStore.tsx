// 状态层：把领域层动作接到 React 状态与本地持久化上。
// 页面只读 store 并调用这里的动作；规则全部来自 domain/scheduler。

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addPhrase as domainAddPhrase,
  canDeletePhrase,
  commitBatch,
  deletePhrase as domainDeletePhrase,
  editPhrase as domainEditPhrase,
} from '../domain/scheduler';
import type { DraftItem, Level, Store } from '../domain/types';
import { dateKey, uid } from '../domain/util';
import { deleteAudios, loadStore, persistStore } from './storage';

export interface NewTake {
  phraseId: string;
  versionId: string;
  versionNo: number;
  phraseText: string;
  translation: string;
  score: number;
  wrongTags: string[];
  durationSec: number;
  audioId?: string;
}

interface StoreApi {
  store: Store;
  addTake: (take: NewTake) => void;
  removeDraftItem: (id: string) => void;
  clearDraft: () => void;
  revalidateDraft: () => void;
  commit: () => { ok: boolean };
  editPhrase: (phraseId: string, text: string, translation: string, tag?: string, level?: Level) => void;
  addPhrase: (text: string, translation: string, tag: string, level: Level) => string;
  removePhrase: (phraseId: string) => void;
  toggleMastered: (phraseId: string, mastered: boolean) => void;
  resetAll: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => loadStore());

  const mutate = useCallback((fn: (s: Store) => Store) => {
    setStore(prev => {
      const next = fn(prev);
      persistStore(next);
      return next;
    });
  }, []);

  const addTake = useCallback(
    (take: NewTake) => {
      mutate(s => {
        const now = new Date();
        const item: DraftItem = {
          id: uid('drf'),
          ...take,
          recordedAt: now.toISOString(),
          dateKey: dateKey(now),
        };
        return {
          ...s,
          draft: { updatedAt: now.toISOString(), items: [...(s.draft?.items ?? []), item], lastConflicts: [] },
        };
      });
    },
    [mutate],
  );

  const removeDraftItem = useCallback(
    (id: string) => {
      mutate(s => {
        if (!s.draft) return s;
        const removed = s.draft.items.find(i => i.id === id);
        const items = s.draft.items.filter(i => i.id !== id);
        if (removed?.audioId) void deleteAudios([removed.audioId]);
        return {
          ...s,
          draft:
            items.length === 0
              ? null
              : { ...s.draft, items, lastConflicts: [] },
        };
      });
    },
    [mutate],
  );

  const clearDraft = useCallback(() => {
    mutate(s => {
      if (s.draft?.items.some(i => i.audioId)) {
        void deleteAudios(s.draft.items.map(i => i.audioId).filter(Boolean) as string[]);
      }
      return { ...s, draft: null };
    });
  }, [mutate]);

  const revalidateDraft = useCallback(() => {
    mutate(s => {
      if (!s.draft || s.draft.items.length === 0) return s;
      const result = commitBatch(s);
      if (result.conflicts.length === 0) return result.store; // 规则已放行 -> 直接提交
      return { ...s, draft: { ...s.draft, lastConflicts: result.conflicts } };
    });
  }, [mutate]);

  const commit = useCallback(() => {
    let ok = false;
    mutate(s => {
      const result = commitBatch(s);
      ok = result.conflicts.length === 0 && (s.draft?.items.length ?? 0) > 0;
      if (result.conflicts.length > 0) {
        // 整批不写入；草稿保留，冲突随草稿持久化（刷新后仍可见）
        return { ...s, draft: s.draft ? { ...s.draft, lastConflicts: result.conflicts } : s.draft };
      }
      return result.store;
    });
    return { ok };
  }, [mutate]);

  const editPhrase = useCallback(
    (phraseId: string, text: string, translation: string, tag?: string, level?: Level) => {
      mutate(s => {
        const withVersion = domainEditPhrase(s, phraseId, text, translation);
        return tag || level
          ? {
              ...withVersion,
              phrases: withVersion.phrases.map(p =>
                p.id === phraseId
                  ? { ...p, tag: tag ?? p.tag, level: level ?? p.level }
                  : p,
              ),
            }
          : withVersion;
      });
    },
    [mutate],
  );

  const addPhrase = useCallback(
    (text: string, translation: string, tag: string, level: Level) => {
      let phraseId = '';
      mutate(s => {
        const r = domainAddPhrase(s, text, translation, tag, level);
        phraseId = r.phraseId;
        return r.store;
      });
      return phraseId;
    },
    [mutate],
  );

  const removePhrase = useCallback(
    (phraseId: string) => {
      mutate(s => {
        if (!canDeletePhrase(s, phraseId)) return s;
        return domainDeletePhrase(s, phraseId);
      });
    },
    [mutate],
  );

  const toggleMastered = useCallback(
    (phraseId: string, mastered: boolean) => {
      mutate(s => ({
        ...s,
        phrases: s.phrases.map(p => (p.id === phraseId ? { ...p, mastered } : p)),
      }));
    },
    [mutate],
  );

  const resetAll = useCallback(() => {
    setStore(() => {
      // 清掉旧领域数据后重建示例（录音保留无害，键不再被引用）
      localStorage.removeItem('voice-lab-scheduler:v1');
      const seed = loadStore();
      return seed;
    });
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      store, addTake, removeDraftItem, clearDraft, revalidateDraft, commit,
      editPhrase, addPhrase, removePhrase, toggleMastered, resetAll,
    }),
    [store, addTake, removeDraftItem, clearDraft, revalidateDraft, commit, editPhrase, addPhrase, removePhrase, toggleMastered, resetAll],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
