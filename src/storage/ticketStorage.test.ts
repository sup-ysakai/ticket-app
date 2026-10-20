import { describe, expect, it, vi } from 'vitest';
import { createEmptyTicketInput } from '../constants/ticket';
import { StorageError } from '../lib/errors';
import { createEmptyStore, createTicket } from '../lib/ticketService';
import { MemoryStorage, makeTicket } from '../test/fixtures';
import {
  RESTORE_POINT_KEY,
  STORAGE_KEY,
  exportStoreJson,
  importStoreJson,
  loadLastBackupTime,
  loadRestorePoint,
  loadStore,
  parseStore,
  readBackupJson,
  recordBackupTime,
  saveRestorePoint,
  saveStore,
} from './ticketStorage';

describe('ticketStorage', () => {
  it('保存したデータを読み込める（再読み込み後もデータが残る）', () => {
    const storage = new MemoryStorage();
    const { store } = createTicket(createEmptyStore(), { ...createEmptyTicketInput(), title: '保存テスト' });
    saveStore(storage, store);
    const loaded = loadStore(storage);
    expect(loaded.error).toBeNull();
    expect(loaded.store).toEqual(store);
  });

  it('データがない場合は空の状態で開始する', () => {
    expect(loadStore(new MemoryStorage())).toEqual({ store: createEmptyStore(), error: null });
  });

  it('破損データは退避してから空の状態で開始する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{壊れたJSON');
    const loaded = loadStore(storage, new Date(1000));
    expect(loaded.store.tickets).toEqual([]);
    expect(loaded.error).toContain('退避');
    expect(storage.getItem(`${STORAGE_KEY}/corrupted-1000`)).toBe('{壊れたJSON');
  });

  it('保存に失敗した場合は分かりやすいエラーを投げる', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new MemoryStorage();
    storage.failOnSet = true;
    expect(() => saveStore(storage, createEmptyStore())).toThrow(/保存容量の上限/);
  });

  it('エクスポートしたJSONをインポートで復元できる', () => {
    const store = { version: 1 as const, nextId: 10, tickets: [makeTicket({ id: 3 }), makeTicket({ id: 7 })], nextProjectId: 1, projects: [] };
    const restored = importStoreJson(exportStoreJson(store));
    expect(restored).toEqual(store);
  });

  it('nextId が既存IDより小さい場合は補正する', () => {
    const store = parseStore({ version: 1, nextId: 1, tickets: [makeTicket({ id: 5 })] });
    expect(store.nextId).toBe(6);
  });

  it('完了以外のチケットの完了日時は消去し、完了なのに完了日時がない場合は補う', () => {
    const store = parseStore({
      version: 1,
      nextId: 3,
      tickets: [
        makeTicket({ id: 1, status: 'todo', completedAt: '2026-10-01T00:00:00.000Z' }),
        makeTicket({ id: 2, status: 'done', completedAt: null, updatedAt: '2026-10-02T00:00:00.000Z' }),
      ],
    });
    expect(store.tickets[0].completedAt).toBeNull();
    expect(store.tickets[1].completedAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('ゴミ箱機能追加前のデータ（deletedAt なし）も読み込める', () => {
    const { deletedAt: _omit, ...legacy } = makeTicket({ id: 1 });
    const store = parseStore({ version: 1, nextId: 2, tickets: [legacy] });
    expect(store.tickets[0].deletedAt).toBeNull();
    expect(() =>
      parseStore({ version: 1, nextId: 2, tickets: [makeTicket({ id: 1, deletedAt: '不正な日時' })] }),
    ).toThrow('項目「deletedAt」');
  });

  it('不正なファイルは原因が分かるエラーにする', () => {
    expect(() => importStoreJson('not json')).toThrow(StorageError);
    expect(() => importStoreJson(JSON.stringify({ version: 2, tickets: [] }))).toThrow(/バージョン/);
    expect(() =>
      importStoreJson(JSON.stringify({ version: 1, tickets: [makeTicket({ id: 1, status: 'unknown' as never })] })),
    ).toThrow('1件目のチケットの項目「status」');
    expect(() =>
      importStoreJson(JSON.stringify({ version: 1, tickets: [makeTicket({ id: 1 }), makeTicket({ id: 1 })] })),
    ).toThrow(/重複/);
  });
});

describe('バックアップ情報・復元前の退避・最終バックアップ日時', () => {
  it('バックアップファイルの作成日時を読み取る（古い形式で記録がなければ null）', () => {
    const store = { version: 1 as const, nextId: 2, tickets: [makeTicket({ id: 1 })], nextProjectId: 1, projects: [] };
    const now = new Date('2026-10-20T01:02:03.000Z');
    expect(readBackupJson(exportStoreJson(store, now))).toEqual({ store, exportedAt: now.toISOString() });
    expect(readBackupJson(JSON.stringify(store)).exportedAt).toBeNull();
  });

  it('復元前のデータを退避・読み込みできる（壊れていれば null）', () => {
    const storage = new MemoryStorage();
    expect(loadRestorePoint(storage)).toBeNull();
    const store = { version: 1 as const, nextId: 2, tickets: [makeTicket({ id: 1 })], nextProjectId: 1, projects: [] };
    const point = saveRestorePoint(storage, store, new Date('2026-10-20T00:00:00.000Z'));
    expect(loadRestorePoint(storage)).toEqual(point);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.setItem(RESTORE_POINT_KEY, '{壊れた');
    expect(loadRestorePoint(storage)).toBeNull();
  });

  it('退避に失敗したら例外を投げる（呼び出し側で復元を中止できる）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new MemoryStorage();
    storage.failOnSet = true;
    expect(() => saveRestorePoint(storage, createEmptyStore())).toThrow(StorageError);
  });

  it('最終バックアップ日時を記録する。記録に失敗しても例外にはしない', () => {
    const storage = new MemoryStorage();
    expect(loadLastBackupTime(storage)).toBeNull();
    expect(recordBackupTime(storage, new Date('2026-10-20T00:00:00.000Z'))).toBe(true);
    expect(loadLastBackupTime(storage)).toBe('2026-10-20T00:00:00.000Z');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.failOnSet = true;
    expect(recordBackupTime(storage)).toBe(false);
  });
});

describe('案件マスターの保存・読み込み', () => {
  it('案件マスター追加前のデータ（projects・projectId なし）も読み込める', () => {
    const { projectId: _omit, ...legacy } = makeTicket({ id: 1 });
    const store = parseStore({ version: 1, nextId: 2, tickets: [legacy] });
    expect(store.projects).toEqual([]);
    expect(store.nextProjectId).toBe(1);
    expect(store.tickets[0].projectId).toBeNull();
  });

  it('案件マスターを含めてバックアップ・復元できる', () => {
    const project = { id: 3, name: '案件A', color: 'sky' as const, createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };
    const store = { version: 1 as const, nextId: 2, tickets: [makeTicket({ id: 1, projectId: 3 })], nextProjectId: 4, projects: [project] };
    expect(importStoreJson(exportStoreJson(store))).toEqual(store);
  });

  it('nextProjectId が既存の案件IDより小さい場合は補正する', () => {
    const project = { id: 5, name: '案件A', color: 'mint', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };
    expect(parseStore({ version: 1, nextId: 1, tickets: [], projects: [project] }).nextProjectId).toBe(6);
  });

  it('不正な案件データは原因が分かるエラーにする', () => {
    const base = { createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };
    expect(() =>
      parseStore({ version: 1, tickets: [], projects: [{ id: 1, name: 'A', color: 'red', ...base }] }),
    ).toThrow('1件目の案件の項目「color」');
    expect(() =>
      parseStore({ version: 1, tickets: [], projects: [{ id: 1, name: 'A', color: 'sky', ...base }, { id: 1, name: 'B', color: 'sky', ...base }] }),
    ).toThrow(/案件IDが重複/);
    // チケットが存在しない案件を参照している
    expect(() => parseStore({ version: 1, tickets: [makeTicket({ id: 1, projectId: 9 })], projects: [] })).toThrow(
      '1件目のチケットの案件（ID: 9）が案件マスターに見つかりません',
    );
  });
});
