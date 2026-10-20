import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { FilterBar } from '../components/FilterBar';
import { Page } from '../components/Page';
import { TicketTable } from '../components/TicketTable';
import { todayString } from '../lib/date';
import {
  applyQuery,
  describeActiveConditions,
  queryFromSearchParams,
  queryToSearchParams,
  type TicketQuery,
} from '../lib/ticketQuery';
import { useTickets } from '../state/TicketContext';

export function TicketListPage() {
  const { tickets, projects } = useTickets();
  // 検索条件はURLに保持する（ダッシュボードからのリンク・再読み込み・ブラウザの戻るに対応）
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => queryFromSearchParams(searchParams), [searchParams]);
  const today = todayString();
  const results = useMemo(() => applyQuery(tickets, query, today), [tickets, query, today]);
  const conditions = describeActiveConditions(query, projects);

  const updateQuery = (patch: Partial<TicketQuery>) => {
    setSearchParams(queryToSearchParams({ ...query, ...patch }), { replace: true });
  };
  // 並び替えは絞り込みではないため、リセットしても維持する
  const resetQuery = () => setSearchParams(queryToSearchParams({ sort: query.sort }), { replace: true });

  return (
    <Page
      width="wide"
      title="チケット一覧"
      documentTitle="チケット一覧"
      description="行をクリックすると詳細を表示します。ステータスは一覧から直接変更できます。"
      actions={
        <Link to="/tickets/new" className="btn btn-primary">
          ＋ 新規登録
        </Link>
      }
    >
      <FilterBar query={query} onChange={updateQuery} />

      {tickets.length === 0 ? (
        <EmptyState title="まだチケットがありません" message="最初のチケットを登録すると、ここに一覧で表示されます。">
          <Link to="/tickets/new" className="btn btn-primary">
            ＋ チケットを登録する
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="result-bar">
            <p className="result-count" aria-live="polite">
              <strong>{results.length}</strong> 件
              <span className="result-total">／ 全 {tickets.length} 件</span>
            </p>
            {conditions.length > 0 ? (
              <ul className="condition-chips" aria-label="適用中の条件">
                {conditions.map((c) => (
                  <li key={c.label} className="chip">
                    <span>{c.label}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`「${c.label}」を解除`}
                      onClick={() => updateQuery(c.clear)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="result-note">すべてのチケットを表示中</span>
            )}
            {conditions.length > 0 && (
              <button type="button" className="btn btn-small result-reset" onClick={resetQuery}>
                条件をリセット
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <EmptyState title="条件に一致するチケットはありません" message="条件を減らすか、リセットしてください。">
              <button type="button" className="btn" onClick={resetQuery}>
                条件をリセット
              </button>
            </EmptyState>
          ) : (
            <TicketTable tickets={results} today={today} />
          )}
        </>
      )}
    </Page>
  );
}
