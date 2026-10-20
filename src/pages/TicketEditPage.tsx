import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { TicketForm } from '../components/TicketForm';
import { formatTicketId } from '../constants/ticket';
import { toTicketInput } from '../lib/ticketService';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import type { TicketInput } from '../types/ticket';
import { TicketNotFound } from './TicketNotFound';
import { useTicketFromParams } from './useTicketFromParams';

export function TicketEditPage() {
  const ticket = useTicketFromParams();
  const { updateTicket } = useTickets();
  const { showToast } = useToast();
  const navigate = useNavigate();
  // 詳細画面の「戻る」の行き先（一覧の検索条件など）を引き継ぐ
  const { state } = useLocation();

  if (!ticket) return <TicketNotFound />;

  const ticketId = formatTicketId(ticket.id);
  const detailPath = `/tickets/${ticket.id}`;
  const handleSubmit = (input: TicketInput) => {
    updateTicket(ticket.id, input);
    showToast(`${ticketId} の変更を保存しました。`);
    navigate(detailPath, { replace: true, state });
  };

  return (
    <Page
      title={
        <>
          {ticketId} を編集
          <span className="editing-badge">編集中</span>
        </>
      }
      documentTitle={`${ticketId} を編集`}
      back={{ to: detailPath, label: '詳細に戻る', state }}
      description="変更内容は「変更を保存」を押すまで反映されません。保存せずに移動しようとすると確認が表示されます。"
    >
      <div className="edit-mode">
        <TicketForm
          key={ticket.id}
          initialValue={toTicketInput(ticket)}
          submitLabel="変更を保存"
          requireChanges
          onSubmit={handleSubmit}
          onCancel={() => navigate(detailPath, { state })}
        />
      </div>
    </Page>
  );
}
