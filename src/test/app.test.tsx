// @vitest-environment jsdom
// 画面操作を通した結合テスト（登録 → メモ → 編集 → 検索 → 再読み込み → 削除）

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayString } from '../lib/date';
import { renderApp } from './renderApp';

describe('チケット管理アプリ（画面操作）', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('登録・メモ・編集・検索・再読み込み・削除が一通り動作する', async () => {
    const user = userEvent.setup();
    renderApp('/');

    // データがない場合の表示
    expect(screen.getByText(/まだチケットがありません/)).toBeTruthy();
    await user.click(screen.getByRole('link', { name: '＋ チケットを登録する' }));

    // 未入力のまま登録 → バリデーションエラー
    await user.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByText('タイトルを入力してください。')).toBeTruthy();

    // 入力して登録（期限は昨日 → 期限超過になる）
    await user.type(screen.getByLabelText(/タイトル/), 'ログイン不具合の調査');
    await user.selectOptions(screen.getByLabelText('優先度'), 'high');
    fireEvent.change(screen.getByLabelText('期限日'), { target: { value: addDays(todayString(), -1) } });
    await user.click(screen.getByRole('button', { name: '登録する' }));

    // 詳細画面に遷移し、登録結果が表示される
    expect(await screen.findByRole('heading', { level: 1, name: /ログイン不具合の調査/ })).toBeTruthy();
    expect(screen.getByText('T-0001 を登録しました。')).toBeTruthy();
    // 期限超過の表示（概要と対応状況の両方に表示される）
    expect(screen.getAllByText('期限超過 1日').length).toBeGreaterThan(0);

    // 作業メモを詳細画面から編集
    await user.click(screen.getByRole('button', { name: 'メモを編集' }));
    await user.type(screen.getByPlaceholderText(/調査結果・対応内容/), '原因はセッション切れ');
    await user.click(screen.getByRole('button', { name: 'メモを保存' }));
    expect(screen.getByText('原因はセッション切れ')).toBeTruthy();

    // ステータスを完了に変更 → 完了日時が記録され、期限超過表示が消える
    await user.click(within(screen.getByRole('group', { name: 'ステータスを変更' })).getByRole('button', { name: /完了/ }));
    expect(screen.queryAllByText('期限超過 1日')).toHaveLength(0);
    expect(screen.getByText('完了済みのため、期限の警告は表示しません。')).toBeTruthy();
    const completedRow = screen.getByText('完了日時').parentElement as HTMLElement;
    expect(within(completedRow).queryByText('未完了')).toBeNull();

    // 編集画面でタイトルを変更
    await user.click(screen.getByRole('link', { name: 'T-0001 を編集' }));
    const titleInput = screen.getByLabelText(/タイトル/);
    await user.clear(titleInput);
    await user.type(titleInput, 'ログイン不具合の修正');
    await user.click(screen.getByRole('button', { name: '変更を保存' }));
    expect(await screen.findByRole('heading', { level: 1, name: /ログイン不具合の修正/ })).toBeTruthy();

    // 一覧で検索・絞り込み
    await user.click(screen.getByRole('link', { name: 'チケット一覧' }));
    expect(screen.getByRole('link', { name: 'ログイン不具合の修正' })).toBeTruthy();
    await user.type(screen.getByRole('searchbox'), '存在しない語');
    expect(screen.getByText('条件に一致するチケットはありません')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: '条件をリセット' })[0]);
    expect(screen.getByRole('link', { name: 'ログイン不具合の修正' })).toBeTruthy();

    // 再読み込み（アプリを作り直す）してもデータが残っている
    cleanup();
    renderApp('/tickets/1');
    expect(screen.getByRole('heading', { level: 1, name: /ログイン不具合の修正/ })).toBeTruthy();
    expect(screen.getByText('原因はセッション切れ')).toBeTruthy();

    // 削除するとゴミ箱へ移動し、一覧から消える（通知の「元に戻す」で戻せる）
    await user.click(screen.getByRole('button', { name: 'ゴミ箱へ移動' }));
    expect(await screen.findByText('まだチケットがありません')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(screen.getByRole('link', { name: 'ログイン不具合の修正' })).toBeTruthy();

    // もう一度ゴミ箱へ移動 → ゴミ箱画面で元に戻す
    await user.click(screen.getByRole('link', { name: 'ログイン不具合の修正' }));
    await user.click(screen.getByRole('button', { name: 'ゴミ箱へ移動' }));
    await user.click(screen.getByRole('link', { name: /^ゴミ箱/ }));
    // 通知にも「元に戻す」があるため、ゴミ箱の表の行に絞って操作する
    const trashRow = screen.getByRole('row', { name: /ログイン不具合の修正/ });
    await user.click(within(trashRow).getByRole('button', { name: '元に戻す' }));
    expect(screen.getByText('ゴミ箱は空です。')).toBeTruthy();

    // ゴミ箱から完全に削除（確認ダイアログでキャンセル → 削除）
    await user.click(screen.getByRole('link', { name: 'チケット一覧' }));
    await user.click(screen.getByRole('link', { name: 'ログイン不具合の修正' }));
    await user.click(screen.getByRole('button', { name: 'ゴミ箱へ移動' }));
    await user.click(screen.getByRole('link', { name: /^ゴミ箱/ }));
    await user.click(screen.getByRole('button', { name: '完全に削除' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('ticket-app/v1') ?? '{}').tickets).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '完全に削除' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '完全に削除する' }));
    expect(screen.getByText('ゴミ箱は空です。')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('ticket-app/v1') ?? '{}').tickets).toEqual([]);
  });

  it('ボードでカードをゴミ箱へドラッグ＆ドロップすると、ゴミ箱に移動する', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const base = {
      description: '', status: 'todo', priority: 'medium', category: '開発', assignee: '自分',
      createdAt: now, updatedAt: now, startDate: null, dueDate: null, completedAt: null, memo: '',
    };
    window.localStorage.setItem(
      'ticket-app/v1',
      JSON.stringify({ version: 1, nextId: 3, tickets: [{ ...base, id: 1, title: '残すカード' }, { ...base, id: 2, title: '捨てるカード' }] }),
    );
    renderApp('/board');

    const dataTransfer = { setData: () => {}, getData: () => '2', effectAllowed: '', dropEffect: '' };
    const trash = screen.getByRole('region', { name: 'ゴミ箱' });
    fireEvent.dragStart(screen.getByRole('article', { name: /捨てるカード/ }), { dataTransfer });
    fireEvent.dragOver(trash, { dataTransfer });
    fireEvent.drop(trash, { dataTransfer });

    // ボードから消え、ゴミ箱の件数が増え、保存データには削除日時が記録される
    expect(screen.queryByRole('article', { name: /捨てるカード/ })).toBeNull();
    expect(screen.getByRole('article', { name: /残すカード/ })).toBeTruthy();
    expect(screen.getByText('T-0002 をゴミ箱に移動しました。')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ゴミ箱を開く（1件）' })).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem('ticket-app/v1') ?? '{}').tickets;
    expect(saved).toHaveLength(2);
    expect(saved[1].deletedAt).not.toBeNull();

    // 通知の「元に戻す」でボードに戻る
    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(screen.getByRole('article', { name: /捨てるカード/ })).toBeTruthy();
  });

  it('ボードでカードをドラッグ＆ドロップするとステータスが変わる', () => {
    const now = '2026-01-01T00:00:00.000Z';
    window.localStorage.setItem(
      'ticket-app/v1',
      JSON.stringify({
        version: 1,
        nextId: 2,
        tickets: [
          {
            id: 1, title: 'ドラッグ対象', description: '', status: 'todo', priority: 'medium', category: '開発',
            assignee: '自分', createdAt: now, updatedAt: now, startDate: null, dueDate: null, completedAt: null, memo: '',
          },
        ],
      }),
    );
    renderApp('/board');

    const card = screen.getByRole('article', { name: /ドラッグ対象/ });
    const doneColumn = screen.getByRole('region', { name: '完了の列' });
    // jsdom には DataTransfer がないため、必要な部分だけを用意する
    const dataTransfer = { setData: () => {}, getData: () => '1', effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn, { dataTransfer });

    // 完了列に移り、保存データにも完了日時が記録される
    expect(within(screen.getByRole('region', { name: '完了の列' })).getByText('ドラッグ対象')).toBeTruthy();
    expect(screen.getByText('T-0001 のステータスを「完了」に変更しました。')).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem('ticket-app/v1') ?? '{}').tickets[0];
    expect(saved.status).toBe('done');
    expect(saved.completedAt).not.toBeNull();
  });

  it('ダッシュボードの件数から絞り込み済みの一覧へ移動できる', async () => {
    const user = userEvent.setup();
    const today = todayString();
    const base = {
      description: '',
      category: '開発',
      assignee: '自分',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      startDate: null,
      completedAt: null,
      memo: '',
    };
    window.localStorage.setItem(
      'ticket-app/v1',
      JSON.stringify({
        version: 1,
        nextId: 4,
        tickets: [
          { ...base, id: 1, title: '超過タスク', status: 'todo', priority: 'high', dueDate: addDays(today, -2) },
          { ...base, id: 2, title: '本日タスク', status: 'in_progress', priority: 'medium', dueDate: today },
          { ...base, id: 3, title: '完了タスク', status: 'done', priority: 'low', dueDate: addDays(today, -5), completedAt: '2026-01-02T00:00:00.000Z' },
        ],
      }),
    );
    renderApp('/');

    const overdueCard = screen.getByRole('link', { name: /期限超過\s*1/ });
    expect(screen.getByRole('link', { name: /全チケット\s*3/ })).toBeTruthy();
    await user.click(overdueCard);

    // 期限超過で絞り込まれた一覧（完了済みは含まれない）。適用中の条件がチップで表示される
    expect(screen.getByText('期限：期限超過')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(2); // 見出し行＋1件
    expect(screen.getByRole('link', { name: '超過タスク' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '完了タスク' })).toBeNull();
  });
});
