// ブラウザの localStorage へのチケットデータ保存・読み込みと、
// バックアップ用 JSON の入出力を担当する。

import {
  PROJECT_COLOR_KEYS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Project,
  type Ticket,
  type TicketStore,
} from '../types/ticket';
import { isValidDateString, isValidIsoDateTime } from '../lib/date';
import { StorageError } from '../lib/errors';
import { createEmptyStore } from '../lib/ticketService';

export const STORAGE_KEY = 'ticket-app/v1';
export const EXPORT_APP_NAME = 'ticket-app';

/** localStorage と同じ形のインターフェース（テストで差し替えるため） */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface LoadResult {
  store: TicketStore;
  /** 読み込みに問題があった場合の説明 */
  error: string | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function nullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isValidDateString(value));
}

/** 1件分のチケットデータを検証する。問題があれば項目名を含むメッセージで例外を投げる */
function parseTicket(raw: unknown, index: number): Ticket {
  const where = `${index + 1}件目のチケット`;
  if (!isRecord(raw)) throw new StorageError(`${where}の形式が正しくありません。`);
  const fail = (field: string): never => {
    throw new StorageError(`${where}の項目「${field}」の値が正しくありません。`);
  };

  if (typeof raw.id !== 'number' || !Number.isInteger(raw.id) || raw.id < 1) fail('id');
  if (typeof raw.title !== 'string' || raw.title.trim() === '') fail('title');
  if (typeof raw.description !== 'string') fail('description');
  if (!oneOf(TICKET_STATUSES, raw.status)) fail('status');
  if (!oneOf(TICKET_PRIORITIES, raw.priority)) fail('priority');
  if (!oneOf(TICKET_CATEGORIES, raw.category)) fail('category');
  if (typeof raw.assignee !== 'string') fail('assignee');
  if (!isValidIsoDateTime(raw.createdAt)) fail('createdAt');
  if (!isValidIsoDateTime(raw.updatedAt)) fail('updatedAt');
  if (!nullableDate(raw.startDate)) fail('startDate');
  if (!nullableDate(raw.dueDate)) fail('dueDate');
  if (raw.completedAt !== null && !isValidIsoDateTime(raw.completedAt)) fail('completedAt');
  if (typeof raw.memo !== 'string') fail('memo');
  // deletedAt はゴミ箱機能の追加時に増えた項目。古いデータにはないため、未設定は null として扱う
  const deletedAt = raw.deletedAt ?? null;
  if (deletedAt !== null && !isValidIsoDateTime(deletedAt)) fail('deletedAt');
  // projectId は案件マスター機能の追加時に増えた項目。古いデータにはないため、未設定は null（案件なし）として扱う
  const projectId = raw.projectId ?? null;
  if (projectId !== null && !(typeof projectId === 'number' && Number.isInteger(projectId) && projectId > 0)) {
    fail('projectId');
  }

  const ticket = raw as unknown as Ticket;
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignee: ticket.assignee,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    startDate: ticket.startDate,
    dueDate: ticket.dueDate,
    // 完了以外のチケットは完了日時を持たない、というルールに合わせる
    completedAt: ticket.status === 'done' ? (ticket.completedAt ?? ticket.updatedAt) : null,
    memo: ticket.memo,
    deletedAt: deletedAt as string | null,
    projectId: projectId as number | null,
  };
}

/** 案件マスター1件分のデータを検証する */
function parseProject(raw: unknown, index: number): Project {
  const where = `${index + 1}件目の案件`;
  if (!isRecord(raw)) throw new StorageError(`${where}の形式が正しくありません。`);
  const fail = (field: string): never => {
    throw new StorageError(`${where}の項目「${field}」の値が正しくありません。`);
  };
  if (typeof raw.id !== 'number' || !Number.isInteger(raw.id) || raw.id < 1) fail('id');
  if (typeof raw.name !== 'string' || raw.name.trim() === '') fail('name');
  if (!oneOf(PROJECT_COLOR_KEYS, raw.color)) fail('color');
  if (!isValidIsoDateTime(raw.createdAt)) fail('createdAt');
  if (!isValidIsoDateTime(raw.updatedAt)) fail('updatedAt');
  const project = raw as unknown as Project;
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** 保存データ・バックアップファイルの内容を検証してストアに変換する */
export function parseStore(raw: unknown): TicketStore {
  if (!isRecord(raw)) throw new StorageError('データの形式が正しくありません。');
  if (raw.version !== 1) {
    throw new StorageError(`対応していないデータのバージョンです（version: ${String(raw.version)}）。`);
  }
  if (!Array.isArray(raw.tickets)) throw new StorageError('チケットの一覧（tickets）が見つかりません。');

  const tickets = raw.tickets.map(parseTicket);
  const ids = new Set<number>();
  for (const t of tickets) {
    if (ids.has(t.id)) throw new StorageError(`チケットIDが重複しています（ID: ${t.id}）。`);
    ids.add(t.id);
  }

  // 案件マスター（古いデータにはないため、未設定は空として扱う）
  if (raw.projects !== undefined && !Array.isArray(raw.projects)) {
    throw new StorageError('案件マスター（projects）の形式が正しくありません。');
  }
  const projects = (raw.projects ?? []).map(parseProject);
  const projectIds = new Set<number>();
  for (const p of projects) {
    if (projectIds.has(p.id)) throw new StorageError(`案件IDが重複しています（ID: ${p.id}）。`);
    projectIds.add(p.id);
  }
  tickets.forEach((t, i) => {
    if (t.projectId !== null && !projectIds.has(t.projectId)) {
      throw new StorageError(`${i + 1}件目のチケットの案件（ID: ${t.projectId}）が案件マスターに見つかりません。`);
    }
  });

  const maxId = tickets.reduce((max, t) => Math.max(max, t.id), 0);
  const savedNextId = typeof raw.nextId === 'number' && Number.isInteger(raw.nextId) ? raw.nextId : 1;
  const maxProjectId = projects.reduce((max, p) => Math.max(max, p.id), 0);
  const savedNextProjectId =
    typeof raw.nextProjectId === 'number' && Number.isInteger(raw.nextProjectId) ? raw.nextProjectId : 1;
  return {
    version: 1,
    nextId: Math.max(savedNextId, maxId + 1),
    tickets,
    nextProjectId: Math.max(savedNextProjectId, maxProjectId + 1),
    projects,
  };
}

/**
 * 保存データを読み込む。
 * データが壊れている場合は、元データを別キーに退避してから空の状態で開始する（データを上書きで失わないため）。
 */
export function loadStore(storage: StorageLike, now: Date = new Date()): LoadResult {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error('[ticket-app] 保存データの読み込みに失敗しました', e);
    return {
      store: createEmptyStore(),
      error: 'ブラウザの保存領域にアクセスできません。プライベートブラウズやCookieのブロック設定を確認してください。',
    };
  }
  if (text === null) return { store: createEmptyStore(), error: null };

  try {
    return { store: parseStore(JSON.parse(text)), error: null };
  } catch (e) {
    console.error('[ticket-app] 保存データが破損しています', e);
    const backupKey = `${STORAGE_KEY}/corrupted-${now.getTime()}`;
    try {
      storage.setItem(backupKey, text);
    } catch (backupError) {
      console.error('[ticket-app] 破損データの退避に失敗しました', backupError);
    }
    const reason = e instanceof Error ? e.message : String(e);
    return {
      store: createEmptyStore(),
      error: `保存データを読み込めなかったため、空の状態で開始しました（原因: ${reason}）。元のデータはブラウザ内の「${backupKey}」に退避しています。`,
    };
  }
}

/** 書き込みの失敗を、原因が分かるメッセージの StorageError に変換する */
function writeItem(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch (e) {
    console.error(`[ticket-app] 保存に失敗しました（${key}）`, e);
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    throw new StorageError(
      quota
        ? 'ブラウザの保存容量の上限に達したため保存できませんでした。不要なチケットを削除するか、バックアップ後にデータを整理してください。'
        : 'ブラウザへの保存に失敗しました。ブラウザの設定（Cookie・サイトデータの保存）を確認してください。',
      { cause: e },
    );
  }
}

export function saveStore(storage: StorageLike, store: TicketStore): void {
  writeItem(storage, STORAGE_KEY, JSON.stringify(store));
}

/** バックアップ用のJSON文字列を作る */
export function exportStoreJson(store: TicketStore, now: Date = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP_NAME, exportedAt: now.toISOString(), ...store }, null, 2);
}

/** バックアップファイルから読み取った内容 */
export interface BackupFileContent {
  store: TicketStore;
  /** バックアップの作成日時（古い形式などで記録がなければ null） */
  exportedAt: string | null;
}

/** バックアップファイルの内容を検証して読み込む（この時点では保存データを一切変更しない） */
export function readBackupJson(text: string): BackupFileContent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new StorageError('JSONファイルとして読み込めませんでした。バックアップしたファイルを選択してください。');
  }
  const store = parseStore(raw);
  const exportedAt = isRecord(raw) && isValidIsoDateTime(raw.exportedAt) ? raw.exportedAt : null;
  return { store, exportedAt };
}

/** バックアップファイルの内容を読み込む */
export function importStoreJson(text: string): TicketStore {
  return readBackupJson(text).store;
}

// ===== 復元前の自動退避 =====

/** 復元直前のデータを退避するキー（直近1回分のみ保持） */
export const RESTORE_POINT_KEY = `${STORAGE_KEY}/restore-point`;

export interface RestorePoint {
  /** 退避した日時（ISO 8601） */
  savedAt: string;
  store: TicketStore;
}

/** 復元前の現在データを退避する。失敗した場合は例外を投げる（呼び出し側は復元を中止する） */
export function saveRestorePoint(storage: StorageLike, store: TicketStore, now: Date = new Date()): RestorePoint {
  const point: RestorePoint = { savedAt: now.toISOString(), store };
  writeItem(storage, RESTORE_POINT_KEY, JSON.stringify(point));
  return point;
}

/** 退避データを読み込む（ない・壊れている場合は null） */
export function loadRestorePoint(storage: StorageLike): RestorePoint | null {
  try {
    const text = storage.getItem(RESTORE_POINT_KEY);
    if (text === null) return null;
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || !isValidIsoDateTime(raw.savedAt)) return null;
    return { savedAt: raw.savedAt, store: parseStore(raw.store) };
  } catch (e) {
    console.error('[ticket-app] 復元前データの読み込みに失敗しました', e);
    return null;
  }
}

// ===== 最終バックアップ日時 =====

export const LAST_BACKUP_KEY = `${STORAGE_KEY}/last-backup-at`;

/** 最終バックアップ日時を記録する（記録に失敗してもバックアップ自体は成功しているため例外は投げない） */
export function recordBackupTime(storage: StorageLike, now: Date = new Date()): boolean {
  try {
    storage.setItem(LAST_BACKUP_KEY, now.toISOString());
    return true;
  } catch (e) {
    console.error('[ticket-app] 最終バックアップ日時の記録に失敗しました', e);
    return false;
  }
}

export function loadLastBackupTime(storage: StorageLike): string | null {
  try {
    const value = storage.getItem(LAST_BACKUP_KEY);
    return isValidIsoDateTime(value) ? value : null;
  } catch {
    return null;
  }
}
