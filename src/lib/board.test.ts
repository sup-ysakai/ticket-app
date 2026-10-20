import { describe, expect, it } from 'vitest';
import { makeTicket } from '../test/fixtures';
import { groupByStatus } from './board';

describe('groupByStatus', () => {
  it('ステータスごとに振り分け、未完了は期限順・完了は完了日時の新しい順に並べる', () => {
    const groups = groupByStatus([
      makeTicket({ id: 1, status: 'todo', dueDate: '2026-10-30' }),
      makeTicket({ id: 2, status: 'todo', dueDate: '2026-10-20' }),
      makeTicket({ id: 3, status: 'todo', dueDate: null }),
      makeTicket({ id: 4, status: 'done', completedAt: '2026-10-01T00:00:00.000Z' }),
      makeTicket({ id: 5, status: 'done', completedAt: '2026-10-10T00:00:00.000Z' }),
      makeTicket({ id: 6, status: 'on_hold' }),
    ]);
    expect(groups.todo.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(groups.in_progress).toEqual([]);
    expect(groups.on_hold.map((t) => t.id)).toEqual([6]);
    expect(groups.done.map((t) => t.id)).toEqual([5, 4]);
  });
});
