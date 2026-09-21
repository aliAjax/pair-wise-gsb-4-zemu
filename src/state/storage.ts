// 存储层：localStorage 存领域数据，IndexedDB 存录音 Blob。
// 只用浏览器自带 API，不增加依赖。

import { buildSeed } from '../domain/seed';
import type { Store } from '../domain/types';

const STORE_KEY = 'voice-lab-scheduler:v1';
const DB_NAME = 'voice-lab-scheduler';
const AUDIO_STORE = 'recordings';

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // 存储损坏时回退到示例数据
  }
  const seed = buildSeed();
  persistStore(seed);
  return seed;
}

export function persistStore(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // 配额失败时保留内存态，不影响当前会话
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

export async function saveAudio(id: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put(blob, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function loadAudio(id: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteAudios(ids: string[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await Promise.all(
    ids.map(
      id =>
        new Promise<void>(resolve => {
          const tx = db.transaction(AUDIO_STORE, 'readwrite');
          tx.objectStore(AUDIO_STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        }),
    ),
  );
}
