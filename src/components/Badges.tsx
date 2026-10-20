// ステータス・優先度・期限の表示部品。
// 全画面でこの部品を使い、色とラベルの表示ルールを統一する。
// - ステータス：丸い点＋ラベルの淡色ピル
// - 優先度：記号（▲■▼）＋ラベルの角丸タグ（色だけに頼らず判別できるようにする）
// - 期限：日付＋状態ラベル（期限超過・本日期限・あとN日）。未設定は「未設定」と明示する
//   完了済みは警告を出さず、日付を控えめに表示する（判定は lib/deadline.ts の getDeadlineState に統一）

import { PRIORITY_LABELS, STATUS_LABELS } from '../constants/ticket';
import { formatDate, formatShortDate } from '../lib/date';
import { daysUntilDue, getDeadlineState } from '../lib/deadline';
import type { Ticket, TicketPriority, TicketStatus } from '../types/ticket';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_ICONS: Record<TicketPriority, string> = { high: '▲', medium: '■', low: '▼' };

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`priority-tag priority-${priority}`} title={`優先度: ${PRIORITY_LABELS[priority]}`}>
      <span className="priority-icon" aria-hidden="true">
        {PRIORITY_ICONS[priority]}
      </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** 期限の状態を短いラベルで表示する（期限に余裕がある・完了済み・未設定の場合は何も表示しない） */
export function DeadlineBadge({ ticket, today }: { ticket: Pick<Ticket, 'status' | 'dueDate'>; today: string }) {
  const state = getDeadlineState(ticket, today);
  const days = daysUntilDue(ticket, today);
  if (state === 'overdue' && days !== null) {
    return <span className="deadline-badge deadline-overdue">期限超過 {-days}日</span>;
  }
  if (state === 'today') return <span className="deadline-badge deadline-today">本日期限</span>;
  if (state === 'soon' && days !== null) {
    return <span className="deadline-badge deadline-soon">あと{days}日</span>;
  }
  return null;
}

/**
 * 期限日＋状態ラベル。期限なしは「未設定」、完了済みは控えめな色で表示する。
 * compact のときは、今年の日付の年を省略する（ボードのカードなど狭い場所向け）。
 */
export function DueDateLabel({
  ticket,
  today,
  compact = false,
}: {
  ticket: Pick<Ticket, 'status' | 'dueDate'>;
  today: string;
  compact?: boolean;
}) {
  if (!ticket.dueDate) return <span className="due-none">未設定</span>;
  const state = getDeadlineState(ticket, today);
  return (
    <span className={`due-label due-${state}`}>
      <span className="due-date" title={compact ? formatDate(ticket.dueDate) : undefined}>
        {compact ? formatShortDate(ticket.dueDate, today) : formatDate(ticket.dueDate)}
      </span>
      <DeadlineBadge ticket={ticket} today={today} />
    </span>
  );
}

/** 期限の状態を文章で説明する（詳細画面で期限日の近くに表示する） */
export function describeDeadline(ticket: Pick<Ticket, 'status' | 'dueDate'>, today: string): string {
  const state = getDeadlineState(ticket, today);
  const days = daysUntilDue(ticket, today);
  switch (state) {
    case 'done':
      return '完了済みのため、期限の警告は表示しません。';
    case 'none':
      return '期限は設定されていません。';
    case 'overdue':
      return `期限を${-(days ?? 0)}日過ぎています。`;
    case 'today':
      return '今日が期限です。';
    default:
      return `期限まであと${days}日です。`;
  }
}
