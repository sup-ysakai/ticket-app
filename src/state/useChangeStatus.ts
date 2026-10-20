import { STATUS_LABELS, formatTicketId } from '../constants/ticket';
import { getErrorMessage } from '../lib/errors';
import type { Ticket, TicketStatus } from '../types/ticket';
import { useTickets } from './TicketContext';
import { useToast } from './ToastContext';

/**
 * ステータスを変更して結果を通知する（ボードのドラッグ＆ドロップ・セレクトボックスで共用）。
 * 変更した場合は true、同じステータスまたは失敗した場合は false を返す。
 */
export function useChangeStatus(): (ticket: Ticket, status: TicketStatus) => boolean {
  const { changeStatus } = useTickets();
  const { showToast } = useToast();

  return (ticket, status) => {
    if (ticket.status === status) return false;
    try {
      changeStatus(ticket.id, status);
      showToast(`${formatTicketId(ticket.id)} のステータスを「${STATUS_LABELS[status]}」に変更しました。`);
      return true;
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      return false;
    }
  };
}
