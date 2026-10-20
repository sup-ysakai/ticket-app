import { STATUS_LABELS } from '../constants/ticket';
import { useChangeStatus } from '../state/useChangeStatus';
import { TICKET_STATUSES, type Ticket } from '../types/ticket';

/**
 * ステータスをボタン1回で切り替える部品（詳細画面用）。
 * 現在のステータスは色付き・押された状態（aria-pressed）で示す。
 * 変更処理は一覧・ボードと同じ useChangeStatus を使う。
 */
export function StatusButtons({ ticket }: { ticket: Ticket }) {
  const changeStatus = useChangeStatus();

  return (
    <div className="status-buttons" role="group" aria-label="ステータスを変更">
      {TICKET_STATUSES.map((s) => {
        const current = ticket.status === s;
        return (
          <button
            key={s}
            type="button"
            className={`status-button ${current ? `is-current status-${s}` : ''}`}
            aria-pressed={current}
            onClick={() => changeStatus(ticket, s)}
          >
            {current && (
              <span className="status-button-check" aria-hidden="true">
                ✓
              </span>
            )}
            {STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
