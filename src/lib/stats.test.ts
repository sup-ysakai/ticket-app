import { describe, expect, it } from 'vitest';
import { makeTicket } from '../test/fixtures';
import { DASHBOARD_QUERIES, computeDashboardStats, dashboardCount, type DashboardQueryKey } from './stats';
import { DEFAULT_QUERY, applyQuery } from './ticketQuery';

describe('computeDashboardStats', () => {
  const TODAY = '2026-10-18';
  const tickets = [
    makeTicket({ id: 1, status: 'todo', dueDate: '2026-10-17', priority: 'high' }),
    makeTicket({ id: 2, status: 'in_progress', dueDate: '2026-10-18' }),
    makeTicket({ id: 3, status: 'in_progress', dueDate: '2026-10-18', priority: 'high' }),
    makeTicket({ id: 4, status: 'on_hold', dueDate: '2026-10-25' }),
    makeTicket({ id: 5, status: 'done', dueDate: '2026-10-01', priority: 'high', completedAt: '2026-10-01T00:00:00.000Z' }),
    makeTicket({ id: 6, status: 'todo', dueDate: '2026-10-26' }),
  ];

  it('ステータス別件数と期限の集計を行う', () => {
    const stats = computeDashboardStats(tickets, TODAY);
    expect(stats.total).toBe(6);
    expect(stats.statusCounts).toEqual({ todo: 2, in_progress: 2, on_hold: 1, done: 1 });
    expect(stats.openCount).toBe(5);
    // 完了済み（ID:5）は期限を過ぎていても期限超過に含めない
    expect(stats.overdue.map((t) => t.id)).toEqual([1]);
    // 本日期限は優先度の高い順
    expect(stats.dueToday.map((t) => t.id)).toEqual([3, 2]);
    // 8日後（ID:6）は含めない
    expect(stats.dueSoon.map((t) => t.id)).toEqual([4]);
    expect(stats.highPriorityOpen.map((t) => t.id)).toEqual([1, 3]);
  });

  it('ダッシュボードの各件数と、リンク先の一覧の絞り込み結果の件数が一致する', () => {
    const stats = computeDashboardStats(tickets, TODAY);
    for (const key of Object.keys(DASHBOARD_QUERIES) as DashboardQueryKey[]) {
      const listed = applyQuery(tickets, { ...DEFAULT_QUERY, ...DASHBOARD_QUERIES[key] }, TODAY);
      expect([key, listed.length]).toEqual([key, dashboardCount(stats, key)]);
    }
  });

  it('チケットがない場合はすべて0件', () => {
    const stats = computeDashboardStats([], TODAY);
    expect(stats.total).toBe(0);
    expect(stats.overdue).toEqual([]);
  });
});
