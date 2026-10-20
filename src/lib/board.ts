import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../types/ticket';
import { sortTickets } from './ticketQuery';

/** 完了日時が新しい順（完了日時がないものは末尾） */
function byCompletedDesc(a: Ticket, b: Ticket): number {
  return (b.completedAt ? Date.parse(b.completedAt) : 0) - (a.completedAt ? Date.parse(a.completedAt) : 0) || b.id - a.id;
}

/**
 * ボード表示用にステータスごとに振り分ける。
 * 未完了の列は期限日が近い順、完了列は完了日時が新しい順に並べる。
 */
export function groupByStatus(tickets: Ticket[]): Record<TicketStatus, Ticket[]> {
  const groups = Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as Ticket[]])) as Record<TicketStatus, Ticket[]>;
  for (const t of tickets) groups[t.status].push(t);
  for (const s of TICKET_STATUSES) {
    groups[s] = s === 'done' ? [...groups[s]].sort(byCompletedDesc) : sortTickets(groups[s], 'due_asc');
  }
  return groups;
}
