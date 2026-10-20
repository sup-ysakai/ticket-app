import { Link, Route, createRoutesFromElements } from 'react-router-dom';
import { EmptyState } from './components/EmptyState';
import { Layout } from './components/Layout';
import { Page } from './components/Page';
import { BoardPage } from './pages/BoardPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataPage } from './pages/DataPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketEditPage } from './pages/TicketEditPage';
import { TicketListPage } from './pages/TicketListPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TicketNewPage } from './pages/TicketNewPage';
import { TrashPage } from './pages/TrashPage';

/** React Router v7 の挙動を先取りする設定（バージョンアップ時の差異と警告をなくす） */
export const ROUTER_FUTURE_FLAGS = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

/** RouterProvider 用の設定 */
export const ROUTER_PROVIDER_FUTURE_FLAGS = { v7_startTransition: true } as const;

function NotFoundPage() {
  return (
    <Page title="ページが見つかりません" documentTitle="ページが見つかりません">
      <EmptyState message="URLが正しいか確認してください。">
        <Link to="/" className="btn">
          ダッシュボードへ
        </Link>
      </EmptyState>
    </Page>
  );
}

/**
 * 画面のルーティング定義（Router は呼び出し側で作成する）。
 * 未保存の変更がある場合の画面移動の確認（useBlocker）を使うため、データルーター形式で定義する。
 */
export const appRoutes = createRoutesFromElements(
  <Route element={<Layout />}>
    <Route index element={<DashboardPage />} />
    <Route path="tickets" element={<TicketListPage />} />
    <Route path="tickets/new" element={<TicketNewPage />} />
    <Route path="tickets/:id" element={<TicketDetailPage />} />
    <Route path="tickets/:id/edit" element={<TicketEditPage />} />
    <Route path="board" element={<BoardPage />} />
    <Route path="projects" element={<ProjectsPage />} />
    <Route path="trash" element={<TrashPage />} />
    <Route path="data" element={<DataPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
);
