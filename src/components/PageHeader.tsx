import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: ReactNode;
  /** ブラウザのタブに表示する文字列 */
  documentTitle: string;
  /** タイトル下の説明文 */
  description?: ReactNode;
  /** タイトル右側の操作ボタン */
  actions?: ReactNode;
  /** タイトル上の「戻る」リンク（state は戻り先の画面へ引き継ぐ情報） */
  back?: { to: string; label: string; state?: unknown };
  /** タイトル下に並べる状態表示（ステータス・優先度・期限など） */
  meta?: ReactNode;
}

/** 全画面共通のページ見出し（戻るリンク → タイトル・操作 → 状態表示 → 説明文の順に配置） */
export function PageHeader({ title, documentTitle, description, actions, back, meta }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${documentTitle} | チケット管理`;
  }, [documentTitle]);

  return (
    <header className="page-header">
      {back && (
        <Link to={back.to} state={back.state} className="back-link">
          ← {back.label}
        </Link>
      )}
      <div className="page-header-main">
        <h1 className="page-title">{title}</h1>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {meta && <div className="page-meta">{meta}</div>}
      {description && <p className="page-subtitle">{description}</p>}
    </header>
  );
}
