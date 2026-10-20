import { describe, expect, it } from 'vitest';
import { createEmptyTicketInput } from '../constants/ticket';
import { TicketNotFoundError, TicketValidationError } from './errors';
import {
  changeStatus,
  createEmptyStore,
  createTicket,
  deleteTicket,
  emptyTrash,
  isTrashed,
  moveToTrash,
  restoreTicket,
  updateMemo,
  updateTicket,
} from './ticketService';

const T1 = new Date('2026-10-18T01:00:00.000Z');
const T2 = new Date('2026-10-18T02:00:00.000Z');
const T3 = new Date('2026-10-18T03:00:00.000Z');
const input = (title = '新しいチケット') => ({ ...createEmptyTicketInput(), title });

describe('ticketService', () => {
  it('登録時にIDを自動採番し、作成・更新日時を設定する', () => {
    const r1 = createTicket(createEmptyStore(), input('A'), T1);
    const r2 = createTicket(r1.store, input('B'), T2);
    expect(r1.ticket.id).toBe(1);
    expect(r2.ticket.id).toBe(2);
    expect(r2.store.tickets).toHaveLength(2);
    expect(r1.ticket.createdAt).toBe(T1.toISOString());
    expect(r1.ticket.updatedAt).toBe(T1.toISOString());
    expect(r1.ticket.completedAt).toBeNull();
  });

  it('元のストアを変更しない', () => {
    const empty = createEmptyStore();
    createTicket(empty, input(), T1);
    expect(empty.tickets).toHaveLength(0);
  });

  it('入力値を正規化して保存する', () => {
    const { ticket } = createTicket(createEmptyStore(), { ...input('  前後に空白  '), dueDate: '' as unknown as null }, T1);
    expect(ticket.title).toBe('前後に空白');
    expect(ticket.dueDate).toBeNull();
  });

  it('不正な入力は保存しない', () => {
    expect(() => createTicket(createEmptyStore(), input(''), T1)).toThrow(TicketValidationError);
  });

  it('更新時は作成日時を維持し、更新日時を変える', () => {
    const { store } = createTicket(createEmptyStore(), input(), T1);
    const { ticket } = updateTicket(store, 1, { ...input('変更後'), priority: 'high' }, T2);
    expect(ticket.title).toBe('変更後');
    expect(ticket.priority).toBe('high');
    expect(ticket.createdAt).toBe(T1.toISOString());
    expect(ticket.updatedAt).toBe(T2.toISOString());
  });

  it('完了にすると完了日時を記録し、完了以外に戻すと消去する', () => {
    const { store } = createTicket(createEmptyStore(), input(), T1);
    const done = changeStatus(store, 1, 'done', T2);
    expect(done.ticket.completedAt).toBe(T2.toISOString());

    // 完了のまま他の項目を更新しても完了日時は変わらない
    const memo = updateMemo(done.store, 1, '完了後のメモ', T3);
    expect(memo.ticket.completedAt).toBe(T2.toISOString());

    const reopened = changeStatus(memo.store, 1, 'in_progress', T3);
    expect(reopened.ticket.completedAt).toBeNull();
  });

  it('完了ステータスで新規登録した場合も完了日時を記録する', () => {
    const { ticket } = createTicket(createEmptyStore(), { ...input(), status: 'done' }, T1);
    expect(ticket.completedAt).toBe(T1.toISOString());
  });

  it('作業メモのみを更新できる', () => {
    const { store } = createTicket(createEmptyStore(), input('件名'), T1);
    const { ticket } = updateMemo(store, 1, '調査結果：再現した', T2);
    expect(ticket.memo).toBe('調査結果：再現した');
    expect(ticket.title).toBe('件名');
  });

  it('削除してもIDは再利用しない', () => {
    let store = createTicket(createEmptyStore(), input('A'), T1).store;
    store = createTicket(store, input('B'), T1).store;
    store = deleteTicket(store, 2);
    expect(store.tickets.map((t) => t.id)).toEqual([1]);
    expect(createTicket(store, input('C'), T2).ticket.id).toBe(3);
  });

  it('ゴミ箱へ移動・元に戻す・ゴミ箱を空にする', () => {
    let store = createTicket(createEmptyStore(), input('A'), T1).store;
    store = createTicket(store, input('B'), T1).store;

    const trashed = moveToTrash(store, 2, T2);
    expect(trashed.ticket.deletedAt).toBe(T2.toISOString());
    expect(isTrashed(trashed.ticket)).toBe(true);
    // ゴミ箱内で更新してもゴミ箱に入ったまま
    expect(updateMemo(trashed.store, 2, 'メモ', T3).ticket.deletedAt).toBe(T2.toISOString());

    const restored = restoreTicket(trashed.store, 2);
    expect(restored.ticket.deletedAt).toBeNull();
    expect(restored.ticket.title).toBe('B');

    const emptied = emptyTrash(trashed.store);
    expect(emptied.tickets.map((t) => t.id)).toEqual([1]);
    // 完全削除後もIDは再利用しない
    expect(createTicket(emptied, input('C'), T3).ticket.id).toBe(3);
  });

  it('ゴミ箱に入っているチケットを再度移動しても削除日時は変わらない', () => {
    const { store } = createTicket(createEmptyStore(), input(), T1);
    const first = moveToTrash(store, 1, T2);
    expect(moveToTrash(first.store, 1, T3).ticket.deletedAt).toBe(T2.toISOString());
  });

  it('存在しないIDの操作はエラー', () => {
    expect(() => deleteTicket(createEmptyStore(), 99)).toThrow(TicketNotFoundError);
    expect(() => changeStatus(createEmptyStore(), 99, 'done', T1)).toThrow(TicketNotFoundError);
  });
});
