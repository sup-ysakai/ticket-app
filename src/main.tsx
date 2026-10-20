import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS, ROUTER_PROVIDER_FUTURE_FLAGS, appRoutes } from './App';
import { TicketProvider } from './state/TicketContext';
import { ToastProvider } from './state/ToastContext';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 要素が見つかりません。index.html を確認してください。');

// ハッシュ方式（#/tickets など）を使い、サーバー設定なし（ビルド後のファイルを直接開く場合も含む）で画面遷移できるようにする
const router = createHashRouter(appRoutes, { future: ROUTER_FUTURE_FLAGS });

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <TicketProvider>
        <RouterProvider router={router} future={ROUTER_PROVIDER_FUTURE_FLAGS} />
      </TicketProvider>
    </ToastProvider>
  </StrictMode>,
);
