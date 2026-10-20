import { STATUS_LABELS } from '../constants/ticket';
import { useChangeStatus } from '../state/useChangeStatus';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../types/ticket';

interface StatusSelectProps {
  ticket: Ticket;
  /** 読み上げ用のラベル */
  label?: string;
}

/**
 * その場でステータスを変更できるセレクトボックス（一覧・詳細・ボードで共用）。
 * 見た目はステータスバッジと同じ配色にそろえている。
 */
export function StatusSelect({ ticket, label = 'ステータス' }: StatusSelectProps) {
  const changeStatus = useChangeStatus();

  return (
    <select
      className={`status-select status-${ticket.status}`}
      aria-label={label}
      value={ticket.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => changeStatus(ticket, e.target.value as TicketStatus)}
    >
      {TICKET_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
