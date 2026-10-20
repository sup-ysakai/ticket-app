import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 見出し（省略可） */
  title?: string;
  message: string;
  children?: ReactNode;
}

/** データが存在しない場合の表示 */
export function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {title && <p className="empty-state-title">{title}</p>}
      <p className="empty-state-message">{message}</p>
      {children && <div className="empty-state-actions">{children}</div>}
    </div>
  );
}
