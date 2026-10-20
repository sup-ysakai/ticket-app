import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../types/ticket';
import { getDeadlineState, isCompleted } from './deadline';
import { sortTickets, type TicketQuery } from './ticketQuery';

export interface DashboardStats {
  total: number;
  statusCounts: Record<TicketStatus, number>;
  openCount: number;
  overdue: Ticket[];
  dueToday: Ticket[];
  /** 明日〜7日後に期限を迎える未完了チケット */
  dueSoon: Ticket[];
  /** 未完了で優先度「高」のチケット */
  highPriorityOpen: Ticket[];
}

/**
 * ダッシュボードの各集計に対応する一覧画面の絞り込み条件。
 * 集計値と一覧の件数が必ず一致するよう、リンク先の条件はここで一元管理する（テストで一致を検証）。
 */
export const DASHBOARD_QUERIES = {
  total: {},
  todo: { status: 'todo' },
  in_progress: { status: 'in_progress' },
  on_hold: { status: 'on_hold' },
  done: { status: 'done' },
  open: { status: 'open' },
  overdue: { deadline: 'overdue' },
  dueToday: { deadline: 'today' },
  dueSoon: { deadline: 'soon' },
  highPriorityOpen: { status: 'open', priority: 'high' },
} as const satisfies Record<string, Partial<TicketQuery>>;

export type DashboardQueryKey = keyof typeof DASHBOARD_QUERIES;

/** 各集計キーの件数 */
export function dashboardCount(stats: DashboardStats, key: DashboardQueryKey): number {
  switch (key) {
    case 'total':
      return stats.total;
    case 'open':
      return stats.openCount;
    case 'overdue':
    case 'dueToday':
    case 'dueSoon':
    case 'highPriorityOpen':
      return stats[key].length;
    default:
      return stats.statusCounts[key];
  }
}

export function computeDashboardStats(tickets: Ticket[], today: string): DashboardStats {
  const statusCounts = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
  const overdue: Ticket[] = [];
  const dueToday: Ticket[] = [];
  const dueSoon: Ticket[] = [];
  const highPriorityOpen: Ticket[] = [];

  for (const t of tickets) {
    statusCounts[t.status] += 1;
    const state = getDeadlineState(t, today);
    if (state === 'overdue') overdue.push(t);
    else if (state === 'today') dueToday.push(t);
    else if (state === 'soon') dueSoon.push(t);
    if (!isCompleted(t) && t.priority === 'high') highPriorityOpen.push(t);
  }

  return {
    total: tickets.length,
    statusCounts,
    openCount: tickets.length - statusCounts.done,
    overdue: sortTickets(overdue, 'due_asc'),
    dueToday: sortTickets(dueToday, 'priority_desc'),
    dueSoon: sortTickets(dueSoon, 'due_asc'),
    highPriorityOpen: sortTickets(highPriorityOpen, 'due_asc'),
  };
}
