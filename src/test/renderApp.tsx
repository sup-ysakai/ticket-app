// 画面テスト用の補助（アプリ全体の描画と、保存データの事前投入）

import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS, ROUTER_PROVIDER_FUTURE_FLAGS, appRoutes } from '../App';
import { STORAGE_KEY } from '../storage/ticketStorage';
import { TicketProvider } from '../state/TicketContext';
import { ToastProvider } from '../state/ToastContext';
import type { Ticket } from '../types/ticket';
import { makeTicket } from './fixtures';

export function renderApp(path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path], future: ROUTER_FUTURE_FLAGS });
  const result = render(
    <ToastProvider>
      <TicketProvider>
        <RouterProvider router={router} future={ROUTER_PROVIDER_FUTURE_FLAGS} />
      </TicketProvider>
    </ToastProvider>,
  );
  return { ...result, router };
}

/** localStorage に保存データを入れておく */
export function seedTickets(tickets: Partial<Ticket>[]): Ticket[] {
  const list = tickets.map((t, i) => makeTicket({ id: i + 1, ...t }));
  const nextId = list.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, nextId, tickets: list }));
  return list;
}
