// @vitest-environment jsdom
// チケット詳細・編集画面の操作（ステータス変更、未保存の変更の確認、戻り先）と、一覧のクイック絞り込みの結合テスト

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayString } from '../lib/date';
import { STORAGE_KEY } from '../storage/ticketStorage';
import { renderApp, seedTickets } from './renderApp';

const saved = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').tickets[0];

describe('チケット詳細画面', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('タイトルの直下にステータス・優先度・期限の概要を表示する', () => {
    seedTickets([{ title: '概要の確認', status: 'in_progress', priority: 'high', dueDate: todayString() }]);
    renderApp('/tickets/1');

    const summary = screen.getByLabelText('対応状況の概要');
    expect(within(summary).getByText('進行中')).toBeTruthy();
    expect(within(summary).getByText('高')).toBeTruthy();
    expect(within(summary).getByText('本日期限')).toBeTruthy();
    expect(screen.getByText('今日が期限です。')).toBeTruthy();
  });

  it('期限が未設定の場合は「未設定」と表示する', () => {
    seedTickets([{ title: '期限なし', dueDate: null }]);
    renderApp('/tickets/1');
    expect(within(screen.getByLabelText('対応状況の概要')).getByText('未設定')).toBeTruthy();
    expect(screen.getByText('期限は設定されていません。')).toBeTruthy();
  });

  it('ステータスをボタン1回で変更でき、現在のステータスが押された状態になる', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '状態変更', status: 'todo', dueDate: addDays(todayString(), -1) }]);
    renderApp('/tickets/1');

    const group = screen.getByRole('group', { name: 'ステータスを変更' });
    expect(within(group).getByRole('button', { name: /未着手/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('期限超過 1日').length).toBeGreaterThan(0);

    await user.click(within(group).getByRole('button', { name: /保留/ }));
    expect(within(group).getByRole('button', { name: /保留/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('T-0001 のステータスを「保留」に変更しました。')).toBeTruthy();
    expect(saved().status).toBe('on_hold');

    // 完了にすると完了日時が記録され、期限超過の警告が消える
    await user.click(within(group).getByRole('button', { name: /完了/ }));
    expect(saved().completedAt).not.toBeNull();
    expect(screen.queryAllByText('期限超過 1日')).toHaveLength(0);

    // ボードにも反映される
    await user.click(screen.getByRole('link', { name: 'ボード' }));
    expect(within(screen.getByRole('region', { name: '完了の列' })).getByText('状態変更')).toBeTruthy();
  });

  it('一覧から開いた場合、「一覧に戻る」で同じ検索条件の一覧に戻る', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '高い', priority: 'high' }, { title: '低い', priority: 'low' }]);
    renderApp('/tickets?priority=high');

    await user.click(screen.getByRole('link', { name: '高い' }));
    await user.click(screen.getByRole('link', { name: '← 一覧に戻る' }));
    expect(screen.getByText('優先度：高')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '低い' })).toBeNull();
  });

  it('ボードから開いた場合は「ボードに戻る」になる', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: 'ボードのカード' }]);
    renderApp('/board');
    await user.click(screen.getByRole('link', { name: 'ボードのカード' }));
    await user.click(screen.getByRole('link', { name: '← ボードに戻る' }));
    expect(screen.getByRole('heading', { level: 1, name: 'ボード' })).toBeTruthy();
  });

  it('作業メモの変更を保存せずにキャンセルすると、破棄してよいか確認する', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: 'メモ', memo: '元のメモ' }]);
    renderApp('/tickets/1');

    await user.click(screen.getByRole('button', { name: 'メモを編集' }));
    expect(screen.getByText('編集中')).toBeTruthy();
    // 変更がないうちは保存できない
    expect((screen.getByRole('button', { name: 'メモを保存' }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByPlaceholderText(/調査結果・対応内容/), '追記');
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    const dialog = screen.getByRole('dialog', { name: 'メモの変更を破棄しますか？' });
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect((screen.getByPlaceholderText(/調査結果・対応内容/) as HTMLTextAreaElement).value).toBe('元のメモ追記');

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '変更を破棄' }));
    expect(screen.getByText('元のメモ')).toBeTruthy();
    expect(saved().memo).toBe('元のメモ');
  });
});

describe('チケット編集画面', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('変更がないうちは保存できず、変更すると未保存であることを表示する', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '編集前' }]);
    renderApp('/tickets/1/edit');

    expect(screen.getByText('編集中')).toBeTruthy();
    const save = screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText('変更はありません')).toBeTruthy();

    await user.type(screen.getByLabelText(/タイトル/), '！');
    expect(save.disabled).toBe(false);
    expect(screen.getByText('● 未保存の変更があります')).toBeTruthy();

    // 元に戻すと「変更なし」に戻る
    await user.type(screen.getByLabelText(/タイトル/), '{Backspace}');
    expect(save.disabled).toBe(true);
  });

  it('未保存の変更がある状態で移動しようとすると確認し、キャンセルで編集を続けられる', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '編集前' }]);
    const { router } = renderApp('/tickets/1/edit');

    await user.clear(screen.getByLabelText(/タイトル/));
    await user.type(screen.getByLabelText(/タイトル/), '編集後');

    // サイドバーから移動しようとする → 確認ダイアログ → キャンセルで残る
    await user.click(screen.getByRole('link', { name: 'ダッシュボード' }));
    const dialog = screen.getByRole('dialog', { name: '保存していない変更があります' });
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(router.state.location.pathname).toBe('/tickets/1/edit');
    expect((screen.getByLabelText(/タイトル/) as HTMLInputElement).value).toBe('編集後');

    // フォームの「キャンセル」でも確認する → 破棄して移動すると保存されない
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '変更を破棄して移動' }));
    expect(router.state.location.pathname).toBe('/tickets/1');
    expect(saved().title).toBe('編集前');
  });

  it('保存した場合は確認を出さずに詳細画面へ戻り、結果を通知する', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '編集前' }]);
    const { router } = renderApp('/tickets/1/edit');

    await user.type(screen.getByLabelText(/タイトル/), '（更新）');
    await user.click(screen.getByRole('button', { name: '変更を保存' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/tickets/1');
    expect(screen.getByText('T-0001 の変更を保存しました。')).toBeTruthy();
    expect(saved().title).toBe('編集前（更新）');
  });

  it('未保存の変更がある間は、タブを閉じる・再読み込みの前にブラウザの確認を出す', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '編集前' }]);
    renderApp('/tickets/1/edit');

    const before = new Event('beforeunload', { cancelable: true });
    fireEvent(window, before);
    expect(before.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText(/タイトル/), '！');
    const after = new Event('beforeunload', { cancelable: true });
    fireEvent(window, after);
    expect(after.defaultPrevented).toBe(true);
  });
});

describe('一覧のクイック絞り込み', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('ボタンで優先度「高」に絞り込み、もう一度押すと解除する', async () => {
    const user = userEvent.setup();
    seedTickets([{ title: '高い', priority: 'high' }, { title: '低い', priority: 'low' }]);
    renderApp('/tickets');

    const group = screen.getByRole('group', { name: 'クイック絞り込み' });
    await user.click(within(group).getByRole('button', { name: '優先度「高」' }));
    expect(within(group).getByRole('button', { name: '優先度「高」' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('link', { name: '低い' })).toBeNull();

    await user.click(within(group).getByRole('button', { name: '優先度「高」' }));
    expect(within(group).getByRole('button', { name: '優先度「高」' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('link', { name: '低い' })).toBeTruthy();
  });
});
