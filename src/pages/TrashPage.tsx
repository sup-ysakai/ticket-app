import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DueDateLabel, PriorityBadge, StatusBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Page } from '../components/Page';
import { ProjectTag } from '../components/ProjectTag';
import { formatTicketId } from '../constants/ticket';
import { formatDateTime, todayString } from '../lib/date';
import { getErrorMessage } from '../lib/errors';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import type { Ticket } from '../types/ticket';

/** 確認ダイアログの対象（1件の完全削除 または ゴミ箱を空にする） */
type PendingAction = { kind: 'delete'; ticket: Ticket } | { kind: 'empty' };

export function TrashPage() {
  const { trashedTickets, restoreTicket, deleteTicket, emptyTrash } = useTickets();
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const today = todayString();

  const run = (action: () => void, message: string) => {
    try {
      action();
      showToast(message);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === 'delete') {
      const { ticket } = pending;
      run(() => deleteTicket(ticket.id), `${formatTicketId(ticket.id)} を完全に削除しました。`);
    } else {
      const count = trashedTickets.length;
      run(emptyTrash, `ゴミ箱を空にしました（${count}件を完全に削除）。`);
    }
    setPending(null);
  };

  return (
    <Page
      width="wide"
      title="ゴミ箱"
      documentTitle="ゴミ箱"
      description="ゴミ箱のチケットは、一覧・ボード・ダッシュボードには表示されません。"
      actions={
        trashedTickets.length > 0 && (
          <button type="button" className="btn btn-danger-outline" onClick={() => setPending({ kind: 'empty' })}>
            ゴミ箱を空にする
          </button>
        )
      }
    >
      <div className="info-grid">
        <div className="info-item">
          <span className="info-item-title">元に戻す</span>
          <span>ゴミ箱に入れる前の状態（ステータス・メモなど）のまま、一覧・ボードに戻ります。</span>
        </div>
        <div className="info-item info-item-danger">
          <span className="info-item-title">完全に削除</span>
          <span>データを削除します。元に戻せません（バックアップからの復元を除く）。</span>
        </div>
      </div>

      {trashedTickets.length === 0 ? (
        <EmptyState title="ゴミ箱は空です。" message="ボードでカードをゴミ箱へドラッグするか、詳細画面の「ゴミ箱へ移動」でチケットをここに移せます。">
          <Link to="/board" className="btn">
            ボードへ
          </Link>
          <Link to="/tickets" className="btn">
            チケット一覧へ
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="result-count">
            <strong>{trashedTickets.length}</strong> 件
          </p>
          <div className="table-wrap card">
            <table className="ticket-table trash-table">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>タイトル</th>
                  <th className="col-status">ステータス</th>
                  <th className="col-priority">優先度</th>
                  <th className="col-due hide-sm">期限日</th>
                  <th className="col-updated">ゴミ箱に移動した日時</th>
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {trashedTickets.map((t) => (
                  <tr key={t.id}>
                    <td className="col-id mono">{formatTicketId(t.id)}</td>
                    <td className="col-title">
                      <span className="trash-title">{t.title}</span>
                      {t.projectId !== null && (
                        <div className="title-project">
                          <ProjectTag projectId={t.projectId} />
                        </div>
                      )}
                    </td>
                    <td className="col-status">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="col-priority">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="col-due hide-sm">
                      <DueDateLabel ticket={t} today={today} />
                    </td>
                    <td className="col-updated">{formatDateTime(t.deletedAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => run(() => restoreTicket(t.id), `${formatTicketId(t.id)} を元に戻しました。`)}
                        >
                          元に戻す
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger-outline"
                          onClick={() => setPending({ kind: 'delete', ticket: t })}
                        >
                          完全に削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'empty' ? 'ゴミ箱を空にしますか？' : 'チケットを完全に削除しますか？'}
        confirmLabel="完全に削除する"
        danger
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p>
          {pending?.kind === 'delete'
            ? `「${formatTicketId(pending.ticket.id)} ${pending.ticket.title}」を完全に削除します。`
            : `ゴミ箱の ${trashedTickets.length} 件をすべて完全に削除します。`}
          <br />
          この操作は取り消せません。
        </p>
      </ConfirmDialog>
    </Page>
  );
}
