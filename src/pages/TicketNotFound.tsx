import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Page } from '../components/Page';

export function TicketNotFound() {
  return (
    <Page title="チケットが見つかりません" documentTitle="チケットが見つかりません">
      <EmptyState message="指定されたチケットは存在しないか、削除されています。">
        <Link to="/tickets" className="btn">
          一覧に戻る
        </Link>
      </EmptyState>
    </Page>
  );
}
