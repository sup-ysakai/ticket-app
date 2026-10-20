import { useParams } from 'react-router-dom';
import { useTickets } from '../state/TicketContext';
import type { Ticket } from '../types/ticket';

/** URLの :id からチケットを取得する（不正なID・存在しない場合は undefined） */
export function useTicketFromParams(): Ticket | undefined {
  const { id } = useParams();
  const { getTicket } = useTickets();
  const numericId = Number(id);
  return Number.isInteger(numericId) ? getTicket(numericId) : undefined;
}
