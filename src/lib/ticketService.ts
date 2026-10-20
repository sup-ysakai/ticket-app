// チケットの登録・更新・削除を行う純粋関数群。
// 元のストアは変更せず、新しいストアを返す（画面状態と保存処理から独立させてテストしやすくする）。

import type { Ticket, TicketInput, TicketStatus, TicketStore } from '../types/ticket';
import { TicketNotFoundError, TicketValidationError } from './errors';
import { hasErrors, normalizeTicketInput, validateTicketInput } from './validation';

export function createEmptyStore(): TicketStore {
  return { version: 1, nextId: 1, tickets: [], nextProjectId: 1, projects: [] };
}

function validated(input: TicketInput, store: TicketStore): TicketInput {
  const normalized = normalizeTicketInput(input);
  const errors = validateTicketInput(normalized);
  if (hasErrors(errors)) {
    throw new TicketValidationError(Object.values(errors).join(' '));
  }
  // 案件は案件マスターに存在するものだけ設定できる
  if (normalized.projectId !== null && !store.projects.some((p) => p.id === normalized.projectId)) {
    throw new TicketValidationError('選択した案件が案件マスターに見つかりません。削除された可能性があります。');
  }
  return normalized;
}

/**
 * 完了日時の決定ルール（完了チケットの扱いをここに統一する）
 * - 完了以外 → 完了：現在日時を記録
 * - 完了 → 完了：既存の完了日時を維持
 * - 完了 → 完了以外：完了日時を消去
 */
export function resolveCompletedAt(
  prev: Pick<Ticket, 'status' | 'completedAt'> | null,
  nextStatus: TicketStatus,
  nowIso: string,
): string | null {
  if (nextStatus !== 'done') return null;
  if (prev?.status === 'done' && prev.completedAt) return prev.completedAt;
  return nowIso;
}

/** チケットから入力項目だけを取り出す（編集フォームの初期値にも使う） */
export function toTicketInput(ticket: Ticket): TicketInput {
  return {
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignee: ticket.assignee,
    startDate: ticket.startDate,
    dueDate: ticket.dueDate,
    memo: ticket.memo,
    projectId: ticket.projectId,
  };
}

function findIndexOrThrow(store: TicketStore, id: number): number {
  const index = store.tickets.findIndex((t) => t.id === id);
  if (index === -1) throw new TicketNotFoundError(id);
  return index;
}

function replaceAt(store: TicketStore, index: number, ticket: Ticket): TicketStore {
  const tickets = [...store.tickets];
  tickets[index] = ticket;
  return { ...store, tickets };
}

export function createTicket(
  store: TicketStore,
  input: TicketInput,
  now: Date = new Date(),
): { store: TicketStore; ticket: Ticket } {
  const data = validated(input, store);
  const nowIso = now.toISOString();
  const ticket: Ticket = {
    ...data,
    id: store.nextId,
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: resolveCompletedAt(null, data.status, nowIso),
    deletedAt: null,
  };
  return {
    store: { ...store, nextId: store.nextId + 1, tickets: [...store.tickets, ticket] },
    ticket,
  };
}

/** 変更内容を適用して更新日時と完了日時を整える共通処理 */
function patchTicket(
  store: TicketStore,
  id: number,
  patch: Partial<TicketInput>,
  now: Date,
): { store: TicketStore; ticket: Ticket } {
  const index = findIndexOrThrow(store, id);
  const prev = store.tickets[index];
  const data = validated({ ...toTicketInput(prev), ...patch }, store);
  const nowIso = now.toISOString();
  const ticket: Ticket = {
    ...data,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: nowIso,
    completedAt: resolveCompletedAt(prev, data.status, nowIso),
    deletedAt: prev.deletedAt,
  };
  return { store: replaceAt(store, index, ticket), ticket };
}

export function isTrashed(ticket: Pick<Ticket, 'deletedAt'>): boolean {
  return ticket.deletedAt !== null;
}

export function updateTicket(store: TicketStore, id: number, input: TicketInput, now: Date = new Date()) {
  return patchTicket(store, id, input, now);
}

export function updateMemo(store: TicketStore, id: number, memo: string, now: Date = new Date()) {
  return patchTicket(store, id, { memo }, now);
}

export function changeStatus(store: TicketStore, id: number, status: TicketStatus, now: Date = new Date()) {
  return patchTicket(store, id, { status }, now);
}

/** ゴミ箱へ移動する（データは残し、元に戻せる） */
export function moveToTrash(store: TicketStore, id: number, now: Date = new Date()) {
  const index = findIndexOrThrow(store, id);
  const prev = store.tickets[index];
  if (isTrashed(prev)) return { store, ticket: prev };
  const ticket: Ticket = { ...prev, deletedAt: now.toISOString() };
  return { store: replaceAt(store, index, ticket), ticket };
}

/** ゴミ箱から元に戻す（ステータスなどはゴミ箱に入れる前のまま） */
export function restoreTicket(store: TicketStore, id: number) {
  const index = findIndexOrThrow(store, id);
  const ticket: Ticket = { ...store.tickets[index], deletedAt: null };
  return { store: replaceAt(store, index, ticket), ticket };
}

/** ゴミ箱内のチケットをすべて完全に削除する */
export function emptyTrash(store: TicketStore): TicketStore {
  return { ...store, tickets: store.tickets.filter((t) => !isTrashed(t)) };
}

/** 完全に削除する（元に戻せない） */
export function deleteTicket(store: TicketStore, id: number): TicketStore {
  const index = findIndexOrThrow(store, id);
  // nextId はそのまま（削除したIDは再利用しない）
  return { ...store, tickets: store.tickets.filter((_, i) => i !== index) };
}
