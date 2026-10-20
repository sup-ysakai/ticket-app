import { describe, expect, it } from 'vitest';
import { makeTicket } from '../test/fixtures';
import { getDeadlineState } from './deadline';
import {
  DEFAULT_QUERY,
  applyQuery,
  describeActiveConditions,
  filterTickets,
  queryFromSearchParams,
  queryToSearchParams,
  sortTickets,
  type TicketQuery,
} from './ticketQuery';

const TODAY = '2026-10-18';

const tickets = [
  makeTicket({ id: 1, title: 'ログイン画面の不具合', description: 'エラー表示が崩れる', category: '不具合', priority: 'high', dueDate: '2026-10-10' }),
  makeTicket({ id: 2, title: '売上レポート作成', status: 'in_progress', category: '資料作成', priority: 'medium', dueDate: '2026-10-18' }),
  makeTicket({ id: 3, title: 'API調査', description: 'ログイン連携の仕様確認', category: '調査', priority: 'low', dueDate: '2026-10-22' }),
  makeTicket({ id: 4, title: '完了済みタスク', status: 'done', completedAt: '2026-10-05T00:00:00.000Z', dueDate: '2026-10-01' }),
  makeTicket({ id: 5, title: '期限なしタスク', status: 'on_hold', priority: 'high', dueDate: null }),
  makeTicket({ id: 6, title: '来月のタスク', dueDate: '2026-11-30', createdAt: '2026-10-10T00:00:00.000Z' }),
];

const q = (patch: Partial<TicketQuery>): TicketQuery => ({ ...DEFAULT_QUERY, ...patch });
const ids = (list: { id: number }[]) => list.map((t) => t.id);

describe('getDeadlineState', () => {
  it('期限の状態を判定し、完了済みは期限判定の対象外にする', () => {
    expect(getDeadlineState(tickets[0], TODAY)).toBe('overdue');
    expect(getDeadlineState(tickets[1], TODAY)).toBe('today');
    expect(getDeadlineState(tickets[2], TODAY)).toBe('soon');
    expect(getDeadlineState(tickets[3], TODAY)).toBe('done');
    expect(getDeadlineState(tickets[4], TODAY)).toBe('none');
    expect(getDeadlineState(tickets[5], TODAY)).toBe('normal');
  });

  it('7日後までを「期限間近」、8日後以降を通常とする', () => {
    expect(getDeadlineState(makeTicket({ dueDate: '2026-10-25' }), TODAY)).toBe('soon');
    expect(getDeadlineState(makeTicket({ dueDate: '2026-10-26' }), TODAY)).toBe('normal');
  });
});

describe('filterTickets', () => {
  it('タイトルと詳細説明をキーワード検索する（大文字小文字・全角スペース区切りに対応）', () => {
    expect(ids(filterTickets(tickets, q({ keyword: 'ログイン' }), TODAY))).toEqual([1, 3]);
    expect(ids(filterTickets(tickets, q({ keyword: 'ログイン　仕様' }), TODAY))).toEqual([3]);
    expect(ids(filterTickets(tickets, q({ keyword: 'api' }), TODAY))).toEqual([3]);
  });

  it('ステータスで絞り込む（未完了 = 完了以外）', () => {
    expect(ids(filterTickets(tickets, q({ status: 'in_progress' }), TODAY))).toEqual([2]);
    expect(ids(filterTickets(tickets, q({ status: 'open' }), TODAY))).toEqual([1, 2, 3, 5, 6]);
  });

  it('期限で絞り込む（完了済みは期限超過に含めない）', () => {
    expect(ids(filterTickets(tickets, q({ deadline: 'overdue' }), TODAY))).toEqual([1]);
    expect(ids(filterTickets(tickets, q({ deadline: 'today' }), TODAY))).toEqual([2]);
    expect(ids(filterTickets(tickets, q({ deadline: 'soon' }), TODAY))).toEqual([3]);
    expect(ids(filterTickets(tickets, q({ deadline: 'none' }), TODAY))).toEqual([5]);
  });

  it('期限日の範囲で絞り込む（範囲指定時、期限なしは除外）', () => {
    expect(ids(filterTickets(tickets, q({ dueFrom: '2026-10-10', dueTo: '2026-10-22' }), TODAY))).toEqual([1, 2, 3]);
    expect(ids(filterTickets(tickets, q({ dueFrom: '2026-10-20' }), TODAY))).toEqual([3, 6]);
  });

  it('複数条件を組み合わせる', () => {
    expect(ids(filterTickets(tickets, q({ priority: 'high', status: 'open', category: '不具合' }), TODAY))).toEqual([1]);
    expect(ids(filterTickets(tickets, q({ priority: 'high', category: '調査' }), TODAY))).toEqual([]);
  });
});

describe('sortTickets', () => {
  it('期限日が近い順（期限なしは末尾）', () => {
    expect(ids(sortTickets(tickets, 'due_asc'))).toEqual([4, 1, 2, 3, 6, 5]);
  });

  it('期限日が遠い順でも期限なしは末尾', () => {
    expect(ids(sortTickets(tickets, 'due_desc'))).toEqual([6, 3, 2, 1, 4, 5]);
  });

  it('優先度が高い順（同じ優先度は期限が近い順）', () => {
    expect(ids(sortTickets(tickets, 'priority_desc')).slice(0, 2)).toEqual([1, 5]);
  });

  it('作成日時が新しい順', () => {
    expect(ids(sortTickets(tickets, 'created_desc'))[0]).toBe(6);
  });

  it('元の配列を変更しない', () => {
    const before = ids(tickets);
    sortTickets(tickets, 'due_desc');
    expect(ids(tickets)).toEqual(before);
  });
});

describe('検索条件とURLの相互変換', () => {
  it('既定値は省略し、往復で同じ条件に戻る', () => {
    const query = q({ keyword: 'ログイン 調査', status: 'open', deadline: 'overdue', dueFrom: '2026-10-01', sort: 'priority_desc' });
    const params = queryToSearchParams(query);
    expect(params.has('priority')).toBe(false);
    expect(queryFromSearchParams(params)).toEqual(query);
  });

  it('不正な値は既定値に置き換える', () => {
    const query = queryFromSearchParams(new URLSearchParams('status=xxx&dueFrom=2026-13-01&sort=bad'));
    expect(query).toEqual(DEFAULT_QUERY);
  });

  it('applyQuery は絞り込みと並び替えを両方適用する', () => {
    expect(ids(applyQuery(tickets, q({ status: 'open', sort: 'due_desc' }), TODAY))).toEqual([6, 3, 2, 1, 5]);
  });
});

describe('describeActiveConditions', () => {
  it('適用中の条件だけをラベル化し、並び替えは含めない', () => {
    const conditions = describeActiveConditions(
      q({ keyword: ' ログイン ', status: 'open', priority: 'high', dueFrom: '2026-10-01', sort: 'priority_desc' }),
    );
    expect(conditions.map((c) => c.label)).toEqual([
      'キーワード：ログイン',
      'ステータス：未完了（完了以外）',
      '優先度：高',
      '期限日：2026/10/01(木)〜',
    ]);
    // 期限日の範囲は開始・終了をまとめて解除する
    expect(conditions[3].clear).toEqual({ dueFrom: '', dueTo: '' });
  });

  it('既定の条件では空', () => {
    expect(describeActiveConditions(DEFAULT_QUERY)).toEqual([]);
  });
});

describe('案件による絞り込み', () => {
  const list = [
    makeTicket({ id: 1, projectId: 1 }),
    makeTicket({ id: 2, projectId: 2 }),
    makeTicket({ id: 3, projectId: null }),
  ];

  it('案件ID・案件なしで絞り込む', () => {
    expect(ids(filterTickets(list, q({ project: '1' }), TODAY))).toEqual([1]);
    expect(ids(filterTickets(list, q({ project: 'none' }), TODAY))).toEqual([3]);
    expect(ids(filterTickets(list, q({ project: '' }), TODAY))).toEqual([1, 2, 3]);
  });

  it('URLとの相互変換と、条件チップの表示名', () => {
    expect(queryFromSearchParams(queryToSearchParams(q({ project: '2' }))).project).toBe('2');
    expect(queryFromSearchParams(new URLSearchParams('project=abc')).project).toBe('');
    const projects = [{ id: 2, name: '案件B' }];
    expect(describeActiveConditions(q({ project: '2' }), projects)[0].label).toBe('案件：案件B');
    expect(describeActiveConditions(q({ project: 'none' }), projects)[0].label).toBe('案件：案件なし');
    expect(describeActiveConditions(q({ project: '9' }), projects)[0].label).toBe('案件：（削除された案件）');
  });
});
