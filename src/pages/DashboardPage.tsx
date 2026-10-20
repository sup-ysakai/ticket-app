import { Link } from 'react-router-dom';
import { DueDateLabel, PriorityBadge, StatusBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { ProjectTag } from '../components/ProjectTag';
import { Page } from '../components/Page';
import { STATUS_LABELS, formatTicketId } from '../constants/ticket';
import { formatDate, todayString } from '../lib/date';
import {
  DASHBOARD_QUERIES,
  computeDashboardStats,
  dashboardCount,
  type DashboardQueryKey,
  type DashboardStats,
} from '../lib/stats';
import { queryToSearchParams } from '../lib/ticketQuery';
import { useTickets } from '../state/TicketContext';
import type { Ticket } from '../types/ticket';
import { fromState } from './backLink';

/** 集計キーに対応する一覧画面へのリンク（条件は DASHBOARD_QUERIES で一元管理） */
function listLink(key: DashboardQueryKey): string {
  const qs = queryToSearchParams(DASHBOARD_QUERIES[key]).toString();
  return qs ? `/tickets?${qs}` : '/tickets';
}

const PANEL_LIMIT = 6;

/** 詳細画面の「ダッシュボードに戻る」用 */
const DASHBOARD_STATE = fromState('/');

type Tone = 'neutral' | 'todo' | 'in_progress' | 'on_hold' | 'done' | 'danger' | 'warn' | 'soon' | 'primary' | 'priority';

interface StatCardProps {
  label: string;
  queryKey: DashboardQueryKey;
  stats: DashboardStats;
  tone: Tone;
  /** 補足説明（要対応カードのみ） */
  hint?: string;
  size?: 'large' | 'small';
}

/** 集計カード。クリックすると同じ条件で絞り込んだ一覧へ移動する */
function StatCard({ label, queryKey, stats, tone, hint, size = 'small' }: StatCardProps) {
  const count = dashboardCount(stats, queryKey);
  // 要注意の項目は件数があるときだけ強調し、0件のときは落ち着いた表示にする
  const highlighted = count > 0 && (tone === 'danger' || tone === 'warn');
  return (
    <Link
      to={listLink(queryKey)}
      className={`stat-card stat-${size} tone-${tone} ${highlighted ? 'is-highlighted' : ''} ${count === 0 ? 'is-zero' : ''}`}
    >
      <span className="stat-label">{label}</span>
      <span className="stat-count">
        {count}
        <span className="stat-unit">件</span>
      </span>
      {hint && <span className="stat-hint">{hint}</span>}
    </Link>
  );
}

interface TicketPanelProps {
  title: string;
  tickets: Ticket[];
  today: string;
  queryKey: DashboardQueryKey;
  emptyMessage: string;
  tone?: 'danger' | 'warn' | 'default';
}

function TicketPanel({ title, tickets, today, queryKey, emptyMessage, tone = 'default' }: TicketPanelProps) {
  const to = listLink(queryKey);
  return (
    <section className={`panel card panel-${tone}`}>
      <div className="panel-header">
        <h2 className="panel-title">
          {title}
          <span className="panel-count">{tickets.length}件</span>
        </h2>
        {tickets.length > 0 && (
          <Link to={to} className="panel-more">
            一覧で表示 →
          </Link>
        )}
      </div>
      {tickets.length === 0 ? (
        <p className="panel-empty">{emptyMessage}</p>
      ) : (
        <ul className="mini-list">
          {tickets.slice(0, PANEL_LIMIT).map((t) => (
            <li key={t.id} className="mini-item">
              <span className="mono mini-id">{formatTicketId(t.id)}</span>
              <Link to={`/tickets/${t.id}`} state={DASHBOARD_STATE} className="mini-title">
                {t.title}
              </Link>
              <span className="mini-meta">
                <ProjectTag projectId={t.projectId} />
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <DueDateLabel ticket={t} today={today} />
              </span>
            </li>
          ))}
          {tickets.length > PANEL_LIMIT && (
            <li className="mini-rest">
              <Link to={to}>ほか {tickets.length - PANEL_LIMIT} 件を一覧で表示</Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { tickets } = useTickets();
  const today = todayString();
  const stats = computeDashboardStats(tickets, today);

  return (
    <Page
      title="ダッシュボード"
      documentTitle="ダッシュボード"
      description={`本日 ${formatDate(today)} ・ 件数をクリックすると、該当するチケットの一覧を表示します。`}
      actions={
        <Link to="/tickets/new" className="btn btn-primary">
          ＋ 新規登録
        </Link>
      }
    >
      {stats.total === 0 ? (
        <EmptyState title="まだチケットがありません" message="最初のチケットを登録しましょう。">
          <Link to="/tickets/new" className="btn btn-primary">
            ＋ チケットを登録する
          </Link>
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="dash-attention" className="dash-section">
            <h2 id="dash-attention" className="dash-section-title">
              要対応
            </h2>
            <div className="stat-grid stat-grid-large">
              <StatCard size="large" label="期限超過" queryKey="overdue" stats={stats} tone="danger" hint="期限を過ぎた未完了" />
              <StatCard size="large" label="本日期限" queryKey="dueToday" stats={stats} tone="warn" hint="今日が期限の未完了" />
              <StatCard size="large" label="7日以内に期限" queryKey="dueSoon" stats={stats} tone="soon" hint="明日〜7日後が期限" />
              <StatCard
                size="large"
                label="優先度「高」"
                queryKey="highPriorityOpen"
                stats={stats}
                tone="priority"
                hint="未完了で優先度が高い"
              />
              <StatCard size="large" label="未完了" queryKey="open" stats={stats} tone="primary" hint="完了以外のすべて" />
            </div>
          </section>

          <section aria-labelledby="dash-status" className="dash-section">
            <h2 id="dash-status" className="dash-section-title">
              ステータス別
            </h2>
            <div className="stat-grid stat-grid-small">
              <StatCard label="全チケット" queryKey="total" stats={stats} tone="neutral" />
              <StatCard label={STATUS_LABELS.todo} queryKey="todo" stats={stats} tone="todo" />
              <StatCard label={STATUS_LABELS.in_progress} queryKey="in_progress" stats={stats} tone="in_progress" />
              <StatCard label={STATUS_LABELS.on_hold} queryKey="on_hold" stats={stats} tone="on_hold" />
              <StatCard label={STATUS_LABELS.done} queryKey="done" stats={stats} tone="done" />
            </div>
          </section>

          <div className="panel-grid">
            <TicketPanel
              title="期限超過"
              tickets={stats.overdue}
              today={today}
              queryKey="overdue"
              emptyMessage="期限を過ぎた未完了チケットはありません。"
              tone="danger"
            />
            <TicketPanel
              title="本日期限"
              tickets={stats.dueToday}
              today={today}
              queryKey="dueToday"
              emptyMessage="本日が期限の未完了チケットはありません。"
              tone="warn"
            />
            <TicketPanel
              title="7日以内に期限（明日以降）"
              tickets={stats.dueSoon}
              today={today}
              queryKey="dueSoon"
              emptyMessage="7日以内に期限を迎える未完了チケットはありません。"
            />
            <TicketPanel
              title="未完了・優先度「高」"
              tickets={stats.highPriorityOpen}
              today={today}
              queryKey="highPriorityOpen"
              emptyMessage="優先度「高」の未完了チケットはありません。"
            />
          </div>
        </>
      )}
    </Page>
  );
}
