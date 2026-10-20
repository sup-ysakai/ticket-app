import { useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { TicketForm } from '../components/TicketForm';
import { createEmptyTicketInput, formatTicketId } from '../constants/ticket';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import type { TicketInput } from '../types/ticket';

export function TicketNewPage() {
  const { createTicket } = useTickets();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (input: TicketInput) => {
    const ticket = createTicket(input);
    showToast(`${formatTicketId(ticket.id)} を登録しました。`);
    navigate(`/tickets/${ticket.id}`, { replace: true });
  };

  // 直接URLを開いた場合など、戻り先の履歴がないときは一覧へ移動する
  const handleCancel = () => (location.key === 'default' ? navigate('/tickets') : navigate(-1));

  return (
    <Page
      title="チケットの新規登録"
      documentTitle="新規登録"
      description="タイトルは必須です。そのほかの項目は後から編集できます。入力途中で移動しようとすると確認が表示されます。"
    >
      <TicketForm
        initialValue={createEmptyTicketInput()}
        submitLabel="登録する"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </Page>
  );
}
