import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTickets } from '../state/TicketContext';

/** メニュー用の簡易アイコン（線画・装飾目的のため読み上げ対象外） */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** 現在のパスがこのメニューに属するか */
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'ダッシュボード',
    icon: <Icon><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></Icon>,
    match: (p) => p === '/',
  },
  {
    to: '/tickets',
    label: 'チケット一覧',
    icon: <Icon><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Icon>,
    // 詳細・編集画面を開いているときも「チケット一覧」を選択中にする（新規登録は除く）
    match: (p) => p === '/tickets' || (p.startsWith('/tickets/') && p !== '/tickets/new'),
  },
  {
    to: '/board',
    label: 'ボード',
    icon: <Icon><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="4" height="8" rx="1" /></Icon>,
    match: (p) => p === '/board',
  },
  {
    to: '/projects',
    label: '案件マスター',
    icon: <Icon><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Icon>,
    match: (p) => p === '/projects',
  },
  {
    to: '/trash',
    label: 'ゴミ箱',
    icon: <Icon><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></Icon>,
    match: (p) => p === '/trash',
  },
  {
    to: '/data',
    label: 'データ管理',
    icon: <Icon><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Icon>,
    match: (p) => p === '/data',
  },
];

/** サイドバー＋メイン領域の共通レイアウト */
export function Layout() {
  const { loadError, trashedTickets } = useTickets();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // 画面遷移したらスマートフォン用メニューを閉じる
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <span className="app-name">チケット管理</span>
          <button
            type="button"
            className="menu-toggle"
            aria-label="メニューを開閉"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="メインメニュー">
          {/* 最もよく使う操作のため、メニューの先頭にボタンとして配置する */}
          <NavLink to="/tickets/new" end className={({ isActive }) => `sidebar-new ${isActive ? 'is-active' : ''}`}>
            ＋ 新規登録
          </NavLink>
          <div className="nav-list">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                // 選択中の判定を独自に行うため NavLink ではなく Link を使う
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                  {item.to === '/trash' && trashedTickets.length > 0 && (
                    <span className="nav-count">{trashedTickets.length}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
      <main className="main">
        {loadError && (
          <div className="page page-wide">
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
