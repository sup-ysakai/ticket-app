import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatTicketId } from '../constants/ticket';
import { formatDateTime } from '../lib/date';
import { getDeadlineState } from '../lib/deadline';
import { projectColorStyle } from '../constants/projectColors';
import { fromState } from '../pages/backLink';
import { useTickets } from '../state/TicketContext';
import type { Ticket } from '../types/ticket';
import { DueDateLabel, PriorityBadge } from './Badges';
import { ProjectTag } from './ProjectTag';
import { StatusSelect } from './StatusSelect';

interface TicketTableProps {
  tickets: Ticket[];
  today: string;
}

/** チケット一覧のテーブル。行（またはタイトル）をクリックすると詳細画面、「編集」で編集画面を開く */
export function TicketTable({ tickets, today }: TicketTableProps) {
  const navigate = useNavigate();
  const { getProject } = useTickets();
  const { pathname, search } = useLocation();
  // 詳細画面の「一覧に戻る」で、今の検索条件の一覧へ戻れるようにする
  const backState = fromState(pathname, search);

  return (
    <div className="table-wrap card">
      <table className="ticket-table">
        <thead>
          <tr>
            <th className="col-id">ID</th>
            <th>タイトル</th>
            <th className="col-status">ステータス</th>
            <th className="col-priority">優先度</th>
            <th className="col-category hide-sm">カテゴリ</th>
            <th className="col-due">期限日</th>
            <th className="col-updated hide-sm">更新日時</th>
            <th className="col-edit hide-sm">
              <span className="visually-hidden">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const deadline = getDeadlineState(t, today);
            const project = getProject(t.projectId);
            return (
              <tr
                key={t.id}
                className={`row-deadline-${deadline} ${project ? 'has-project' : ''}`}
                style={projectColorStyle(project?.color)}
                onClick={() => navigate(`/tickets/${t.id}`, { state: backState })}
              >
                <td className="col-id mono">{formatTicketId(t.id)}</td>
                <td className="col-title">
                  <Link to={`/tickets/${t.id}`} state={backState} onClick={(e) => e.stopPropagation()}>
                    {t.title}
                  </Link>
                  {project && (
                    <div className="title-project">
                      <ProjectTag project={project} />
                    </div>
                  )}
                </td>
                <td className="col-status">
                  <StatusSelect ticket={t} label={`${formatTicketId(t.id)} のステータス`} />
                </td>
                <td className="col-priority">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="col-category hide-sm">
                  <span className="category-tag">{t.category}</span>
                </td>
                <td className="col-due">
                  <DueDateLabel ticket={t} today={today} />
                </td>
                <td className="col-updated hide-sm">{formatDateTime(t.updatedAt)}</td>
                <td className="col-edit hide-sm">
                  <Link
                    to={`/tickets/${t.id}/edit`}
                    state={backState}
                    className="btn btn-small btn-ghost"
                    aria-label={`${formatTicketId(t.id)} を編集`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    編集
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
