// @vitest-environment jsdom
// データ管理（バックアップ・復元）、ナビゲーション、一覧の条件表示の結合テスト

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_BACKUP_KEY, RESTORE_POINT_KEY, STORAGE_KEY } from '../storage/ticketStorage';
import { makeTicket } from './fixtures';
import { renderApp, seedTickets } from './renderApp';

const savedTickets = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').tickets as { id: number; title: string }[];

/** 復元用のファイルを選択する（hidden の input に直接ファイルを渡す） */
function selectFile(content: string, name = 'backup.json') {
  const file = new File([content], name, { type: 'application/json' });
  fireEvent.change(screen.getByTestId('restore-file'), { target: { files: [file] } });
}

describe('データ管理', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('不正なファイルを選んでも既存データは変更されず、原因が表示される', async () => {
    seedTickets([{ title: '既存チケット' }]);
    const before = window.localStorage.getItem(STORAGE_KEY);
    renderApp('/data');

    selectFile('{ これはJSONではない', 'broken.json');
    expect(await screen.findByText(/「broken\.json」は復元に使えません。JSONファイルとして読み込めませんでした/)).toBeTruthy();
    expect(screen.getByText(/現在のデータは変更されていません/)).toBeTruthy();

    // 必要な項目が欠けているファイル
    selectFile(JSON.stringify({ version: 1, tickets: [{ id: 1, title: '' }] }), 'invalid.json');
    expect(await screen.findByText(/1件目のチケットの項目「title」の値が正しくありません/)).toBeTruthy();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(window.localStorage.getItem(RESTORE_POINT_KEY)).toBeNull();
  });

  it('内容を確認してから復元し、件数を表示する。復元前の状態にも戻せる', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '既存A' }, { title: '既存B' }]);
    renderApp('/data');

    const backup = {
      app: 'ticket-app',
      exportedAt: '2026-10-01T03:00:00.000Z',
      version: 1,
      nextId: 12,
      tickets: [
        makeTicket({ id: 10, title: '復元X' }),
        makeTicket({ id: 11, title: '復元Y', deletedAt: '2026-09-30T00:00:00.000Z' }),
      ],
    };
    selectFile(JSON.stringify(backup), 'tickets-backup.json');

    // 確認画面：ファイルと現在のデータの件数を比較できる（この時点ではまだ置き換わらない）
    const preview = await screen.findByLabelText('復元する内容の確認');
    expect(within(preview).getByText('2件（通常 1件・ゴミ箱 1件）')).toBeTruthy();
    expect(within(preview).getByText('2件（通常 2件・ゴミ箱 0件）')).toBeTruthy();
    expect(savedTickets().map((t) => t.title)).toEqual(['既存A', '既存B']);

    await user.click(screen.getByRole('button', { name: 'この内容で復元する…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '置き換えて復元する' }));

    expect(screen.getByText('「tickets-backup.json」から 2件（通常 1件・ゴミ箱 1件） を復元しました。')).toBeTruthy();
    expect(savedTickets().map((t) => t.title)).toEqual(['復元X', '復元Y']);
    // 復元前のデータが自動で退避されている
    expect(JSON.parse(window.localStorage.getItem(RESTORE_POINT_KEY) ?? '{}').store.tickets).toHaveLength(2);

    // 復元前の状態に戻す
    await user.click(screen.getByRole('button', { name: '復元前の状態に戻す…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '復元前の状態に戻す' }));
    expect(screen.getByText('復元前の状態（2件（通常 2件・ゴミ箱 0件））に戻しました。')).toBeTruthy();
    expect(savedTickets().map((t) => t.title)).toEqual(['既存A', '既存B']);
  });

  it('復元前の退避に失敗した場合は復元を中止し、データを変更しない', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '既存A' }]);
    const before = window.localStorage.getItem(STORAGE_KEY);
    renderApp('/data');
    selectFile(JSON.stringify({ version: 1, nextId: 2, tickets: [makeTicket({ id: 1, title: '新' })] }));
    await screen.findByLabelText('復元する内容の確認');

    // 保存容量の不足を再現する
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await user.click(screen.getByRole('button', { name: 'この内容で復元する…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '置き換えて復元する' }));

    expect(screen.getByRole('alert').textContent).toMatch(/復元を中止しました。.*保存容量の上限.*現在のデータは変更されていません/);
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('バックアップをダウンロードすると最終バックアップ日時を記録する', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: 'A' }, { title: 'B', deletedAt: '2026-10-01T00:00:00.000Z' }]);
    // jsdom にはファイルのダウンロード機能がないため、必要な部分を差し替える
    const createUrl = vi.fn(() => 'blob:mock');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/data');

    expect(screen.getByText('まだバックアップしていません')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'バックアップをダウンロード' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/のダウンロードを開始しました（2件）。/)).toBeTruthy();
    expect(window.localStorage.getItem(LAST_BACKUP_KEY)).not.toBeNull();
    expect(screen.queryByText('まだバックアップしていません')).toBeNull();
  });
});

describe('ナビゲーションと一覧の条件表示', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('詳細画面を開いているときは「チケット一覧」が選択中になる', () => {
    seedTickets([{ title: '詳細を見る' }]);
    renderApp('/tickets/1');
    const nav = screen.getByRole('navigation', { name: 'メインメニュー' });
    expect(within(nav).getByRole('link', { name: 'チケット一覧' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'ダッシュボード' }).getAttribute('aria-current')).toBeNull();
  });

  it('適用中の条件をチップで表示し、個別に解除・まとめてリセットできる', async () => {
    const user = userEvent.setup();
    seedTickets([
      { title: '高い', priority: 'high' },
      { title: '低い', priority: 'low', status: 'done', completedAt: '2026-10-01T00:00:00.000Z' },
    ]);
    renderApp('/tickets?priority=high&status=open&sort=created_desc');

    expect(screen.getByText('優先度：高')).toBeTruthy();
    expect(screen.getByText('ステータス：未完了（完了以外）')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '低い' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '「優先度：高」を解除' }));
    expect(screen.queryByText('優先度：高')).toBeNull();
    expect(screen.getByText('ステータス：未完了（完了以外）')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '条件をリセット' }));
    expect(screen.getByText('すべてのチケットを表示中')).toBeTruthy();
    expect(screen.getByRole('link', { name: '低い' })).toBeTruthy();
    // 並び替えは絞り込み条件ではないため、リセット後も維持される
    expect((screen.getByLabelText('並び替え') as HTMLSelectElement).value).toBe('created_desc');
  });
});
