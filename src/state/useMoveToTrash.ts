import { formatTicketId } from '../constants/ticket';
import { getErrorMessage } from '../lib/errors';
import type { Ticket } from '../types/ticket';
import { useTickets } from './TicketContext';
import { useToast } from './ToastContext';

/**
 * チケットをゴミ箱へ移動し、「元に戻す」ボタン付きの通知を出す（ボード・詳細画面で共用）。
 * 成功したら true を返す。
 */
export function useMoveToTrash(): (ticket: Ticket) => boolean {
  const { moveToTrash, restoreTicket } = useTickets();
  const { showToast } = useToast();

  return (ticket) => {
    const ticketId = formatTicketId(ticket.id);
    const undo = () => {
      try {
        restoreTicket(ticket.id);
        showToast(`${ticketId} を元に戻しました。`);
      } catch (e) {
        showToast(getErrorMessage(e), 'error');
      }
    };
    try {
      moveToTrash(ticket.id);
      showToast(`${ticketId} をゴミ箱に移動しました。`, 'success', { label: '元に戻す', onClick: undo });
      return true;
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      return false;
    }
  };
}
