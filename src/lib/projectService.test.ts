import { describe, expect, it } from 'vitest';
import { createEmptyTicketInput } from '../constants/ticket';
import { makeTicket } from '../test/fixtures';
import type { TicketStore } from '../types/ticket';
import { TicketValidationError } from './errors';
import { ProjectNotFoundError, countTicketsByProject, createProject, deleteProject, updateProject } from './projectService';
import { createEmptyStore, createTicket, updateTicket } from './ticketService';

const T1 = new Date('2026-10-21T01:00:00.000Z');
const T2 = new Date('2026-10-21T02:00:00.000Z');

describe('projectService（案件マスター）', () => {
  it('案件を追加するとIDを自動採番し、前後の空白を除いて保存する', () => {
    const r1 = createProject(createEmptyStore(), { name: '  案件A  ', color: 'sky' }, T1);
    const r2 = createProject(r1.store, { name: '案件B', color: 'mint' }, T1);
    expect(r1.project).toEqual({ id: 1, name: '案件A', color: 'sky', createdAt: T1.toISOString(), updatedAt: T1.toISOString() });
    expect(r2.project.id).toBe(2);
    expect(r2.store.projects.map((p) => p.name)).toEqual(['案件A', '案件B']);
  });

  it('案件名は必須・重複不可（大文字小文字・空白の違いも同じとみなす）', () => {
    const { store } = createProject(createEmptyStore(), { name: 'Alpha 案件', color: 'sky' }, T1);
    expect(() => createProject(store, { name: '   ', color: 'sky' }, T1)).toThrow(TicketValidationError);
    expect(() => createProject(store, { name: 'alpha　案件', color: 'mint' }, T1)).toThrow('同じ名前の案件');
    expect(() => createProject(store, { name: '別案件', color: 'red' as never }, T1)).toThrow('色を選択');
  });

  it('案件を更新できる（自分自身と同じ名前はそのまま保存できる）', () => {
    const { store } = createProject(createEmptyStore(), { name: '案件A', color: 'sky' }, T1);
    const { project } = updateProject(store, 1, { name: '案件A', color: 'lavender' }, T2);
    expect(project.color).toBe('lavender');
    expect(project.createdAt).toBe(T1.toISOString());
    expect(project.updatedAt).toBe(T2.toISOString());
    expect(() => updateProject(store, 99, { name: 'x', color: 'sky' })).toThrow(ProjectNotFoundError);
  });

  it('案件を削除すると、その案件のチケット（ゴミ箱内も含む）は「案件なし」になり、IDは再利用しない', () => {
    let store: TicketStore = createProject(createEmptyStore(), { name: '案件A', color: 'sky' }, T1).store;
    store = createProject(store, { name: '案件B', color: 'mint' }, T1).store;
    store = {
      ...store,
      tickets: [
        makeTicket({ id: 1, projectId: 1 }),
        makeTicket({ id: 2, projectId: 1, deletedAt: T1.toISOString() }),
        makeTicket({ id: 3, projectId: 2 }),
      ],
    };
    const { store: after, affected } = deleteProject(store, 1);
    expect(affected).toBe(2);
    expect(after.tickets.map((t) => t.projectId)).toEqual([null, null, 2]);
    // チケットの内容は変わらないため、更新日時は変えない
    expect(after.tickets[0].updatedAt).toBe(store.tickets[0].updatedAt);
    expect(after.projects.map((p) => p.id)).toEqual([2]);
    expect(createProject(after, { name: '案件C', color: 'lemon' }).project.id).toBe(3);
  });

  it('案件ごとのチケット件数はゴミ箱内を除いて数える', () => {
    const store = {
      ...createEmptyStore(),
      tickets: [
        makeTicket({ id: 1, projectId: 1 }),
        makeTicket({ id: 2, projectId: 1 }),
        makeTicket({ id: 3, projectId: 1, deletedAt: T1.toISOString() }),
        makeTicket({ id: 4, projectId: null }),
      ],
    };
    expect(countTicketsByProject(store).get(1)).toBe(2);
  });

  it('チケットには案件マスターにある案件だけ設定できる', () => {
    const { store } = createProject(createEmptyStore(), { name: '案件A', color: 'sky' }, T1);
    const created = createTicket(store, { ...createEmptyTicketInput(), title: 'T', projectId: 1 }, T1);
    expect(created.ticket.projectId).toBe(1);
    expect(() => createTicket(store, { ...createEmptyTicketInput(), title: 'T', projectId: 9 }, T1)).toThrow('案件マスターに見つかりません');
    // 案件を外す
    const cleared = updateTicket(created.store, created.ticket.id, { ...createEmptyTicketInput(), title: 'T', projectId: null }, T2);
    expect(cleared.ticket.projectId).toBeNull();
  });
});
