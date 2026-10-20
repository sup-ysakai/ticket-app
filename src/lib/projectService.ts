// 案件マスターの登録・更新・削除を行う純粋関数群（ticketService と同じく、新しいストアを返す）

import type { Project, ProjectInput, TicketStore } from '../types/ticket';
import { TicketValidationError } from './errors';
import { hasErrors, validateProjectInput } from './validation';

export class ProjectNotFoundError extends Error {
  constructor(id: number) {
    super(`案件（ID: ${id}）が見つかりません。削除された可能性があります。`);
    this.name = 'ProjectNotFoundError';
  }
}

function validatedProject(input: ProjectInput, store: TicketStore, selfId: number | null): ProjectInput {
  const normalized: ProjectInput = { name: input.name.trim(), color: input.color };
  const errors = validateProjectInput(normalized, store.projects, selfId);
  if (hasErrors(errors)) throw new TicketValidationError(Object.values(errors).join(' '));
  return normalized;
}

export function createProject(
  store: TicketStore,
  input: ProjectInput,
  now: Date = new Date(),
): { store: TicketStore; project: Project } {
  const data = validatedProject(input, store, null);
  const nowIso = now.toISOString();
  const project: Project = { ...data, id: store.nextProjectId, createdAt: nowIso, updatedAt: nowIso };
  return {
    store: { ...store, nextProjectId: store.nextProjectId + 1, projects: [...store.projects, project] },
    project,
  };
}

export function updateProject(
  store: TicketStore,
  id: number,
  input: ProjectInput,
  now: Date = new Date(),
): { store: TicketStore; project: Project } {
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1) throw new ProjectNotFoundError(id);
  const data = validatedProject(input, store, id);
  const project: Project = { ...store.projects[index], ...data, updatedAt: now.toISOString() };
  const projects = [...store.projects];
  projects[index] = project;
  return { store: { ...store, projects }, project };
}

/**
 * 案件を削除する。この案件を設定していたチケット（ゴミ箱内を含む）は「案件なし」にする。
 * チケットの内容自体は変わらないため、チケットの更新日時は変更しない。
 */
export function deleteProject(store: TicketStore, id: number): { store: TicketStore; affected: number } {
  if (!store.projects.some((p) => p.id === id)) throw new ProjectNotFoundError(id);
  let affected = 0;
  const tickets = store.tickets.map((t) => {
    if (t.projectId !== id) return t;
    affected += 1;
    return { ...t, projectId: null };
  });
  // nextProjectId はそのまま（削除したIDは再利用しない）
  return { store: { ...store, tickets, projects: store.projects.filter((p) => p.id !== id) }, affected };
}

/** 案件ごとのチケット件数（ゴミ箱内は除く） */
export function countTicketsByProject(store: TicketStore): Map<number, number> {
  const counts = new Map<number, number>();
  for (const t of store.tickets) {
    if (t.projectId === null || t.deletedAt !== null) continue;
    counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
  }
  return counts;
}
