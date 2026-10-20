import { useState, type DragEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DueDateLabel, PriorityBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { Page } from '../components/Page';
import { ProjectTag } from '../components/ProjectTag';
import { StatusSelect } from '../components/StatusSelect';
import { projectColorStyle } from '../constants/projectColors';
import { STATUS_LABELS, formatTicketId } from '../constants/ticket';
import { groupByStatus } from '../lib/board';
import { todayString } from '../lib/date';
import { getDeadlineState } from '../lib/deadline';
import { DEFAULT_QUERY, filterTickets, queryFromSearchParams } from '../lib/ticketQuery';
import { useTickets } from '../state/TicketContext';
import { useChangeStatus } from '../state/useChangeStatus';
import { useMoveToTrash } from '../state/useMoveToTrash';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../types/ticket';
import { fromState, type FromState } from './backLink';

/** 完了列に表示する最大件数（古い完了チケットで列が長くなりすぎないようにする） */
const DONE_COLUMN_LIMIT = 30;

/** ドロップ先（ステータスの列 または ゴミ箱） */
type DropTarget = TicketStatus | 'trash';

interface BoardCardProps {
  ticket: Ticket;
  /** 詳細画面の「ボードに戻る」用（絞り込み条件を含む） */
  backState: FromState;
  today: string;
  dragging: boolean;
  onDragStart: (e: DragEvent<HTMLElement>, ticket: Ticket) => void;
  onDragEnd: () => void;
}

function BoardCard({ ticket, backState, today, dragging, onDragStart, onDragEnd }: BoardCardProps) {
  const navigate = useNavigate();
  const { getProject } = useTickets();
  const project = getProject(ticket.projectId);
  return (
    <article
      className={`board-card card-deadline-${getDeadlineState(ticket, today)} ${project ? 'has-project' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={projectColorStyle(project?.color)}
      draggable
      aria-label={`${formatTicketId(ticket.id)} ${ticket.title}`}
      onDragStart={(e) => onDragStart(e, ticket)}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/tickets/${ticket.id}`, { state: backState })}
    >
      {/* 縦幅を抑えるため3行にまとめる：①ID・案件・優先度 ②タイトル（2行まで） ③カテゴリ・期限・ステータス */}
      <div className="board-card-head">
        <span className="mono board-card-id">{formatTicketId(ticket.id)}</span>
        {project && <ProjectTag project={project} />}
        <span className="board-card-priority">
          <PriorityBadge priority={ticket.priority} />
        </span>
      </div>
      <Link
        to={`/tickets/${ticket.id}`}
        state={backState}
        className="board-card-title"
        title={ticket.title}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        {ticket.title}
      </Link>
      <div className="board-card-meta">
        <span className="category-tag">{ticket.category}</span>
        <DueDateLabel ticket={ticket} today={today} compact />
        {/* ドラッグできない環境（スマートフォン・キーボード操作）向けの切り替え */}
        <span className="board-card-status">
          <StatusSelect ticket={ticket} label={`${formatTicketId(ticket.id)} のステータス`} />
        </span>
      </div>
    </article>
  );
}

export function BoardPage() {
  const { tickets, trashedTickets, projects } = useTickets();
  // 案件の絞り込み条件はURLに保持する（詳細画面から戻ったときも維持される）
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = queryFromSearchParams(searchParams).project;
  const backState = fromState('/board', searchParams.toString() ? `?${searchParams.toString()}` : '');
  const visibleTickets = filterTickets(tickets, { ...DEFAULT_QUERY, project: projectFilter }, todayString());
  const changeStatus = useChangeStatus();
  const moveToTrash = useMoveToTrash();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null);
  const today = todayString();
  const groups = groupByStatus(visibleTickets);
  const dragging = draggingId !== null;

  const handleDragStart = (e: DragEvent<HTMLElement>, ticket: Ticket) => {
    setDraggingId(ticket.id);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox はデータを設定しないとドラッグが始まらないため設定する
    e.dataTransfer.setData('text/plain', String(ticket.id));
  };

  const endDrag = () => {
    setDraggingId(null);
    setOverTarget(null);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, target: DropTarget) => {
    e.preventDefault();
    const id = draggingId ?? Number(e.dataTransfer.getData('text/plain'));
    endDrag();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;
    // ゴミ箱への移動とステータス変更は別の処理として扱う
    if (target === 'trash') moveToTrash(ticket);
    else changeStatus(ticket, target);
  };

  /** ドロップ先として受け付けるためのイベント設定（列とゴミ箱で共用） */
  const dropZoneProps = (target: DropTarget) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overTarget !== target) setOverTarget(target);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      // ドロップ先の中の子要素へ移動したときは解除しない
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverTarget(null);
    },
    onDrop: (e: DragEvent<HTMLElement>) => handleDrop(e, target),
  });

  return (
    <Page
      width="wide"
      title="ボード"
      documentTitle="ボード"
      description="カードを別の列へドラッグするとステータスを変更します。ゴミ箱へドラッグするとゴミ箱に移動します（あとで元に戻せます）。"
      actions={
        <Link to="/tickets/new" className="btn btn-primary">
          ＋ 新規登録
        </Link>
      }
    >
      <div className="board-toolbar">
        <label className="board-filter">
          <span className="filter-label">案件で絞り込み</span>
          <select
            value={projectFilter}
            onChange={(e) =>
              setSearchParams(e.target.value ? { project: e.target.value } : {}, { replace: true })
            }
          >
            <option value="">すべての案件</option>
            <option value="none">案件なし</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <span className="board-count" aria-live="polite">
          {projectFilter ? `${visibleTickets.length}件を表示中（全 ${tickets.length}件）` : `全 ${tickets.length}件`}
        </span>
      </div>

      <section
        className={`trash-zone ${dragging ? 'is-active' : ''} ${overTarget === 'trash' ? 'is-over' : ''}`}
        aria-label="ゴミ箱"
        {...dropZoneProps('trash')}
      >
        <span className="trash-zone-icon" aria-hidden="true">
          🗑
        </span>
        <span className="trash-zone-text">
          {dragging ? 'ここにドロップするとゴミ箱へ移動（ステータスは変わりません）' : 'ゴミ箱'}
        </span>
        <Link to="/trash" className="trash-zone-link">
          ゴミ箱を開く（{trashedTickets.length}件）
        </Link>
      </section>

      {tickets.length === 0 ? (
        <EmptyState title="まだチケットがありません" message="チケットを登録すると、ステータスごとの列に表示されます。">
          <Link to="/tickets/new" className="btn btn-primary">
            ＋ チケットを登録する
          </Link>
        </EmptyState>
      ) : (
        <div className={`board ${dragging ? 'is-dragging' : ''}`}>
          {TICKET_STATUSES.map((status) => {
            const all = groups[status];
            const shown = status === 'done' ? all.slice(0, DONE_COLUMN_LIMIT) : all;
            return (
              <section
                key={status}
                className={`board-column column-${status} ${overTarget === status ? 'is-over' : ''}`}
                aria-label={`${STATUS_LABELS[status]}の列`}
                {...dropZoneProps(status)}
              >
                <h2 className="board-column-title">
                  <span className="board-column-name">
                    <span className="board-column-dot" aria-hidden="true" />
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="board-column-count">{all.length}</span>
                </h2>
                <div className="board-column-body">
                  {shown.map((t) => (
                    <BoardCard
                      key={t.id}
                      ticket={t}
                      backState={backState}
                      today={today}
                      dragging={draggingId === t.id}
                      onDragStart={handleDragStart}
                      onDragEnd={endDrag}
                    />
                  ))}
                  {all.length === 0 && <p className="board-empty">チケットはありません</p>}
                  {all.length > shown.length && (
                    <Link to="/tickets?status=done&sort=updated_desc" className="board-more">
                      ほか {all.length - shown.length} 件を一覧で表示
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
