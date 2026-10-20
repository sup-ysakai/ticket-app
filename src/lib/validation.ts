import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  PROJECT_COLOR_KEYS,
  TICKET_STATUSES,
  type Project,
  type ProjectInput,
  type TicketInput,
} from '../types/ticket';
import { isValidDateString } from './date';

export const INPUT_LIMITS = {
  projectName: 40,
  title: 100,
  description: 5000,
  assignee: 50,
  memo: 20000,
} as const;

export type TicketFormErrors = Partial<Record<keyof TicketInput, string>>;

/** 前後の空白除去と、空の日付を null にそろえる */
export function normalizeTicketInput(input: TicketInput): TicketInput {
  return {
    ...input,
    title: input.title.trim(),
    assignee: input.assignee.trim(),
    startDate: input.startDate ? input.startDate : null,
    dueDate: input.dueDate ? input.dueDate : null,
    projectId: input.projectId ?? null,
  };
}

function includes<T extends string>(list: readonly T[], value: string): boolean {
  return (list as readonly string[]).includes(value);
}

/** 正規化済みの入力値を検証し、項目ごとのエラーメッセージを返す */
export function validateTicketInput(input: TicketInput): TicketFormErrors {
  const errors: TicketFormErrors = {};

  if (!input.title) errors.title = 'タイトルを入力してください。';
  else if (input.title.length > INPUT_LIMITS.title) {
    errors.title = `タイトルは${INPUT_LIMITS.title}文字以内で入力してください。`;
  }

  if (input.description.length > INPUT_LIMITS.description) {
    errors.description = `詳細説明は${INPUT_LIMITS.description}文字以内で入力してください。`;
  }

  if (!input.assignee) errors.assignee = '担当者を入力してください。';
  else if (input.assignee.length > INPUT_LIMITS.assignee) {
    errors.assignee = `担当者は${INPUT_LIMITS.assignee}文字以内で入力してください。`;
  }

  if (input.memo.length > INPUT_LIMITS.memo) {
    errors.memo = `作業メモは${INPUT_LIMITS.memo}文字以内で入力してください。`;
  }

  if (input.projectId !== null && !(Number.isInteger(input.projectId) && input.projectId > 0)) {
    errors.projectId = '案件を選択し直してください。';
  }

  if (!includes(TICKET_STATUSES, input.status)) errors.status = 'ステータスを選択してください。';
  if (!includes(TICKET_PRIORITIES, input.priority)) errors.priority = '優先度を選択してください。';
  if (!includes(TICKET_CATEGORIES, input.category)) errors.category = 'カテゴリを選択してください。';

  if (input.startDate && !isValidDateString(input.startDate)) {
    errors.startDate = '開始予定日の形式が正しくありません。';
  }
  if (input.dueDate && !isValidDateString(input.dueDate)) {
    errors.dueDate = '期限日の形式が正しくありません。';
  }
  if (!errors.startDate && !errors.dueDate && input.startDate && input.dueDate && input.startDate > input.dueDate) {
    errors.dueDate = '期限日は開始予定日以降の日付にしてください。';
  }

  return errors;
}

export function hasErrors(errors: Partial<Record<string, string>>): boolean {
  return Object.keys(errors).length > 0;
}

export type ProjectFormErrors = Partial<Record<keyof ProjectInput, string>>;

/** 案件名の比較用（前後の空白・大文字小文字・全角半角スペースの違いを無視する） */
function projectNameKey(name: string): string {
  return name.trim().replace(/[\s　]+/g, ' ').toLowerCase();
}

/**
 * 案件マスターの入力値を検証する。
 * selfId は編集中の案件のID（同じ案件自身との重複は許可する）。
 */
export function validateProjectInput(input: ProjectInput, projects: Project[], selfId: number | null = null): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = '案件名を入力してください。';
  else if (name.length > INPUT_LIMITS.projectName) {
    errors.name = `案件名は${INPUT_LIMITS.projectName}文字以内で入力してください。`;
  } else if (projects.some((p) => p.id !== selfId && projectNameKey(p.name) === projectNameKey(name))) {
    errors.name = '同じ名前の案件がすでに登録されています。';
  }
  if (!includes(PROJECT_COLOR_KEYS, input.color)) errors.color = '色を選択してください。';
  return errors;
}
