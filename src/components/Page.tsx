import type { ComponentProps, ReactNode } from 'react';
import { PageHeader } from './PageHeader';

/**
 * ページの最大幅
 * - wide: 一覧・ボードなど横に情報が多い画面
 * - default: ダッシュボード・詳細・フォーム
 * - narrow: 文章中心の画面（データ管理など）
 */
export type PageWidth = 'wide' | 'default' | 'narrow';

type PageProps = ComponentProps<typeof PageHeader> & {
  width?: PageWidth;
  children?: ReactNode;
};

/** 全画面共通のページ枠。幅をそろえて中央に配置し、見出しの位置を統一する */
export function Page({ width = 'default', children, ...header }: PageProps) {
  return (
    <div className={`page page-${width}`}>
      <PageHeader {...header} />
      {children}
    </div>
  );
}
