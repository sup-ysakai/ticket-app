import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DueDateLabel, PriorityBadge, StatusBadge, describeDeadline } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MemoTextarea } from '../components/MemoTextarea';
import { Page } from '../components/Page';
import { ProjectTag } from '../components/ProjectTag';
import { StatusButtons } from '../components/StatusButtons';
import { projectColorStyle } from '../constants/projectColors';
import { useUnsavedChangesGuard } from '../components/useUnsavedChangesGuard';
import { formatTicketId } from '../constants/ticket';
import { formatDate, formatDateTime, todayString } from '../lib/date';
import { getDeadlineState } from '../lib/deadline';
import { getErrorMessage } from '../lib/errors';
import { INPUT_LIMITS } from '../lib/validation';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import { useMoveToTrash } from '../state/useMoveToTrash';
import type { Ticket } from '../types/ticket';
import { getBackLink } from './backLink';
import { useTicketFromParams } from './useTicketFromParams';
import { TicketNotFound } from './TicketNotFound';

/** 作業メモの表示・編集（詳細画面から直接編集できる） */
function MemoSection({ ticket }: { ticket: Ticket }) {
  const { updateMemo } = useTickets();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ticket.memo);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const tooLong = draft.length > INPUT_LIMITS.memo;
  const dirty = editing && draft !== ticket.memo;
  // 編集中のメモが未保存のまま画面を移動しようとした場合に確認する
  const guard = useUnsavedChangesGuard(dirty);

  const startEdit = () => {
    setDraft(ticket.memo);
    setSaveError(null);
    setEditing(true);
  };

  const finishEdit = () => {
    setEditing(false);
    setConfirmDiscard(false);
    setSaveError(null);
  };

  const save = () => {
    if (!dirty || tooLong) return;
    try {
      updateMemo(ticket.id, draft);
      finishEdit();
      showToast('作業メモを保存しました。');
    } catch (e) {
      const message = getErrorMessage(e);
      setSaveError(`保存できませんでした。${message}`);
      showToast(message, 'error');
    }
  };

  // 変更がある場合だけ、破棄してよいか確認する
  const cancel = () => (dirty ? setConfirmDiscard(true) : finishEdit());

  return (
    <section className={`card detail-section ${editing ? 'is-editing' : ''}`} aria-labelledby="memo-title">
      <div className="section-header">
        <h2 id="memo-title" className="section-title">
          作業メモ
          {editing && <span className="editing-badge">編集中</span>}
        </h2>
        {!editing && (
          <button type="button" className="btn btn-small" onClick={startEdit}>
            メモを編集
          </button>
        )}
      </div>
      {editing ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              save();
            }
          }}
        >
          <MemoTextarea id="memo-editor" value={draft} onChange={setDraft} rows={12} invalid={tooLong} />
          {tooLong && <p className="field-error">作業メモは{INPUT_LIMITS.memo}文字以内で入力してください。</p>}
          {saveError && (
            <div className="alert alert-error" role="alert">
              {saveError}
            </div>
          )}
          <div className="form-actions">
            <span className="form-status">{dirty ? '未保存の変更があります' : '変更はありません'}</span>
            <button type="button" className="btn" onClick={cancel}>
              キャンセル
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || tooLong}>
              メモを保存
            </button>
          </div>
        </div>
      ) : ticket.memo ? (
        <div className="pre-text">{ticket.memo}</div>
      ) : (
        <p className="muted">作業メモはまだありません。「メモを編集」から調査結果や対応内容を記録できます。</p>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="メモの変更を破棄しますか？"
        confirmLabel="変更を破棄"
        danger
        onConfirm={finishEdit}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>入力したメモの変更は保存されません。</p>
      </ConfirmDialog>
      {guard.prompt}
    </section>
  );
}

export function TicketDetailPage() {
  const ticket = useTicketFromParams();
  const moveToTrash = useMoveToTrash();
  const navigate = useNavigate();
  const location = useLocation();
  const { getProject } = useTickets();

  if (!ticket) return <TicketNotFound />;

  const today = todayString();
  const ticketId = formatTicketId(ticket.id);
  const back = getBackLink(location.state);
  const deadlineState = getDeadlineState(ticket, today);
  const project = getProject(ticket.projectId);

  // ゴミ箱へ移動するだけで元に戻せるため、確認ダイアログは出さず「元に戻す」付きの通知を出す
  const handleMoveToTrash = () => {
    if (moveToTrash(ticket)) navigate(back.to);
  };

  return (
    <Page
      back={back}
      documentTitle={`${ticketId} ${ticket.title}`}
      title={
        <>
          <span className="title-id mono">{ticketId}</span>
          {ticket.title}
        </>
      }
      actions={
        <>
          <Link
            to={`/tickets/${ticket.id}/edit`}
            state={location.state}
            className="btn btn-primary"
            aria-label={`${ticketId} を編集`}
          >
            編集
          </Link>
          {/* 削除系の操作は、通常の操作と離して枠線のみの赤色で表示する */}
          <button
            type="button"
            className="btn btn-danger-outline action-separated"
            onClick={handleMoveToTrash}
            title="ゴミ箱へ移動します。ゴミ箱から元に戻せます。"
          >
            ゴミ箱へ移動
          </button>
        </>
      }
      meta={
        <dl className="summary-list" aria-label="対応状況の概要">
          <div className={project ? 'summary-project' : ''} style={projectColorStyle(project?.color)}>
            <dt>案件</dt>
            <dd>
              <ProjectTag project={project} showNone />
            </dd>
          </div>
          <div>
            <dt>ステータス</dt>
            <dd>
              <StatusBadge status={ticket.status} />
            </dd>
          </div>
          <div>
            <dt>優先度</dt>
            <dd>
              <PriorityBadge priority={ticket.priority} />
            </dd>
          </div>
          <div className={`summary-due summary-due-${deadlineState}`}>
            <dt>期限</dt>
            <dd>
              <DueDateLabel ticket={ticket} today={today} />
            </dd>
          </div>
        </dl>
      }
    >
      <div className="detail-grid">
        <div className="detail-main">
          <section className="card detail-section" aria-labelledby="basic-title">
            <h2 id="basic-title" className="section-title">
              基本情報
            </h2>
            <dl className="kv-list">
              <div>
                <dt>チケットID</dt>
                <dd className="mono">{ticketId}</dd>
              </div>
              <div>
                <dt>案件</dt>
                <dd>
                  <ProjectTag project={project} showNone />
                </dd>
              </div>
              <div>
                <dt>カテゴリ</dt>
                <dd>
                  <span className="category-tag">{ticket.category}</span>
                </dd>
              </div>
              <div>
                <dt>詳細説明</dt>
                <dd>
                  {ticket.description ? (
                    <div className="pre-text">{ticket.description}</div>
                  ) : (
                    <span className="muted">詳細説明は登録されていません。</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <MemoSection key={ticket.id} ticket={ticket} />
        </div>

        <div className="detail-side-column">
          <section className="card detail-section" aria-labelledby="progress-title">
            <h2 id="progress-title" className="section-title">
              対応状況
            </h2>
            <div className="field-block">
              <span className="field-block-label">ステータス（クリックで変更）</span>
              <StatusButtons ticket={ticket} />
            </div>
            <dl className="meta-list">
              <div>
                <dt>優先度</dt>
                <dd>
                  <PriorityBadge priority={ticket.priority} />
                </dd>
              </div>
              <div>
                <dt>担当者</dt>
                <dd>{ticket.assignee}</dd>
              </div>
              <div>
                <dt>開始予定日</dt>
                <dd>{ticket.startDate ? formatDate(ticket.startDate) : <span className="due-none">未設定</span>}</dd>
              </div>
              <div>
                <dt>期限日</dt>
                <dd>
                  <DueDateLabel ticket={ticket} today={today} />
                  <p className={`deadline-note deadline-note-${deadlineState}`}>{describeDeadline(ticket, today)}</p>
                </dd>
              </div>
              <div>
                <dt>完了日時</dt>
                <dd>{ticket.completedAt ? formatDateTime(ticket.completedAt) : <span className="due-none">未完了</span>}</dd>
              </div>
            </dl>
          </section>

          <section className="card detail-section" aria-labelledby="history-title">
            <h2 id="history-title" className="section-title">
              更新情報
            </h2>
            <dl className="meta-list">
              <div>
                <dt>作成日時</dt>
                <dd>{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt>更新日時</dt>
                <dd>{formatDateTime(ticket.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </Page>
  );
}
