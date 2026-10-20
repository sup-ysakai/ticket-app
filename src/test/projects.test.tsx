// @vitest-environment jsdom
// 案件マスター（登録・編集・削除）と、チケットへの設定・色分け・絞り込みの結合テスト

import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../storage/ticketStorage';
import { makeTicket } from './fixtures';
import { renderApp } from './renderApp';

const savedStore = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');

/** 案件マスター付きの保存データを入れておく */
function seedWithProjects() {
  const at = '2026-10-21T00:00:00.000Z';
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      nextId: 4,
      nextProjectId: 3,
      projects: [
        { id: 1, name: '案件A', color: 'sky', createdAt: at, updatedAt: at },
        { id: 2, name: '案件B', color: 'sakura', createdAt: at, updatedAt: at },
      ],
      tickets: [
        makeTicket({ id: 1, title: 'Aのチケット', projectId: 1 }),
        makeTicket({ id: 2, title: 'Bのチケット', projectId: 2 }),
        makeTicket({ id: 3, title: '案件なしのチケット', projectId: null }),
      ],
    }),
  );
}

describe('案件マスター', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('案件名と色を設定して追加でき、重複した名前はエラーになる', async () => {
    const user = userEvent.setup();
    renderApp('/projects');
    expect(screen.getByText('案件はまだありません')).toBeTruthy();

    await user.type(screen.getByLabelText(/案件名/), '案件A');
    await user.click(screen.getByRole('radio', { name: 'ミント' }));
    await user.click(screen.getByRole('button', { name: '追加する' }));

    expect(screen.getByText('案件「案件A」を追加しました。')).toBeTruthy();
    expect(savedStore().projects).toMatchObject([{ id: 1, name: '案件A', color: 'mint' }]);
    // 追加後は入力欄が空に戻る
    expect((screen.getByLabelText(/案件名/) as HTMLInputElement).value).toBe('');

    await user.type(screen.getByLabelText(/案件名/), ' 案件a ');
    await user.click(screen.getByRole('button', { name: '追加する' }));
    expect(screen.getByText('同じ名前の案件がすでに登録されています。')).toBeTruthy();
    expect(savedStore().projects).toHaveLength(1);
  });

  it('案件の色を変更すると、チケットの表示色も変わる', async () => {
    const user = userEvent.setup();
    seedWithProjects();
    renderApp('/projects');

    await user.click(screen.getByRole('button', { name: '案件「案件A」を編集' }));
    await user.click(within(screen.getByRole('radiogroup', { name: '「案件A」の色' })).getByRole('radio', { name: 'ラベンダー' }));
    await user.click(screen.getByRole('button', { name: '変更を保存' }));
    expect(savedStore().projects[0].color).toBe('lavender');

    await user.click(screen.getByRole('link', { name: 'チケット一覧' }));
    const row = screen.getByRole('link', { name: 'Aのチケット' }).closest('tr') as HTMLElement;
    expect(row.className).toContain('has-project');
    expect(row.style.getPropertyValue('--project-bg')).toBe('#f4effd');
  });

  it('使用中の案件を削除すると確認し、チケットは「案件なし」になる（チケット自体は残る）', async () => {
    const user = userEvent.setup();
    seedWithProjects();
    renderApp('/projects');

    await user.click(screen.getByRole('button', { name: '案件「案件A」を削除' }));
    const dialog = screen.getByRole('dialog', { name: '案件を削除しますか？' });
    expect(within(dialog).getByText(/チケット（1件）は「案件なし」になります/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));

    expect(screen.getByText('案件「案件A」を削除しました（1件のチケットを「案件なし」にしました）。')).toBeTruthy();
    const store = savedStore();
    expect(store.projects.map((p: { name: string }) => p.name)).toEqual(['案件B']);
    expect(store.tickets.map((t: { projectId: number | null }) => t.projectId)).toEqual([null, 2, null]);
  });
});

describe('チケットへの案件の設定と絞り込み', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('新規登録で案件を選ぶと、詳細・一覧・ボードに案件名と色が表示される', async () => {
    const user = userEvent.setup();
    seedWithProjects();
    renderApp('/tickets/new');

    await user.type(screen.getByLabelText(/タイトル/), '新しいチケット');
    await user.selectOptions(screen.getByLabelText('案件'), '2');
    await user.click(screen.getByRole('button', { name: '登録する' }));

    // 詳細画面：概要に案件を表示
    const summary = await screen.findByLabelText('対応状況の概要');
    expect(within(summary).getByText('案件B')).toBeTruthy();
    expect(savedStore().tickets[3].projectId).toBe(2);

    // ボード：カードの背景が案件の色になる
    await user.click(screen.getByRole('link', { name: 'ボード' }));
    const card = screen.getByRole('article', { name: /新しいチケット/ });
    expect(card.className).toContain('has-project');
    expect(card.style.getPropertyValue('--project-bg')).toBe('#fdeef5');
    expect(within(card).getByText('案件B')).toBeTruthy();
  });

  it('一覧で案件による絞り込みができ、条件チップに案件名が表示される', async () => {
    const user = userEvent.setup();
    seedWithProjects();
    renderApp('/tickets');

    await user.selectOptions(screen.getByLabelText('案件'), '1');
    expect(screen.getByText('案件：案件A')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Aのチケット' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Bのチケット' })).toBeNull();

    await user.selectOptions(screen.getByLabelText('案件'), 'none');
    expect(screen.getByRole('link', { name: '案件なしのチケット' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Aのチケット' })).toBeNull();
  });

  it('ボードで案件による絞り込みができ、詳細から戻っても絞り込みが維持される', async () => {
    const user = userEvent.setup();
    seedWithProjects();
    renderApp('/board');

    await user.selectOptions(screen.getByLabelText('案件で絞り込み'), '2');
    expect(screen.getByText('1件を表示中（全 3件）')).toBeTruthy();
    expect(screen.queryByRole('article', { name: /Aのチケット/ })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Bのチケット' }));
    await user.click(screen.getByRole('link', { name: '← ボードに戻る' }));
    expect((screen.getByLabelText('案件で絞り込み') as HTMLSelectElement).value).toBe('2');
    expect(screen.queryByRole('article', { name: /Aのチケット/ })).toBeNull();
  });
});
