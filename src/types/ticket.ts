// チケットに関する型定義。
// 定数配列から型を導出し、実行時の値チェックと型を一致させる。

export const TICKET_STATUSES = ['todo', 'in_progress', 'on_hold', 'done'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  '開発',
  '改修',
  '不具合',
  '調査',
  '問い合わせ',
  '資料作成',
  'その他',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export interface Ticket {
  /** 自動採番されるID（削除されても再利用しない） */
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assignee: string;
  /** 作成日時（ISO 8601 / UTC） */
  createdAt: string;
  /** 更新日時（ISO 8601 / UTC） */
  updatedAt: string;
  /** 開始予定日（ローカル日付 YYYY-MM-DD） */
  startDate: string | null;
  /** 期限日（ローカル日付 YYYY-MM-DD） */
  dueDate: string | null;
  /** 完了日時（ISO 8601 / UTC）。ステータスが完了のときのみ値を持つ */
  completedAt: string | null;
  /** 作業メモ */
  memo: string;
  /** ゴミ箱に移動した日時（ISO 8601 / UTC）。null ならゴミ箱に入っていない */
  deletedAt: string | null;
  /** 案件ID（案件マスターの Project.id）。null は「案件なし」 */
  projectId: number | null;
}

/** 画面から入力できる項目 */
export type TicketInput = Pick<
  Ticket,
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'category'
  | 'assignee'
  | 'startDate'
  | 'dueDate'
  | 'memo'
  | 'projectId'
>;

/** 案件の色（パステルカラーの名前。色コードは constants/projectColors.ts で定義） */
export const PROJECT_COLOR_KEYS = [
  'sakura',
  'coral',
  'peach',
  'sand',
  'lemon',
  'lime',
  'mint',
  'aqua',
  'sky',
  'periwinkle',
  'lavender',
  'gray',
] as const;
export type ProjectColor = (typeof PROJECT_COLOR_KEYS)[number];

/** 案件マスター */
export interface Project {
  /** 自動採番されるID（削除されても再利用しない） */
  id: number;
  name: string;
  color: ProjectColor;
  /** 作成日時（ISO 8601 / UTC） */
  createdAt: string;
  /** 更新日時（ISO 8601 / UTC） */
  updatedAt: string;
}

/** 案件マスターで入力できる項目 */
export type ProjectInput = Pick<Project, 'name' | 'color'>;

/** 永続化するデータ全体 */
export interface TicketStore {
  version: 1;
  /** 次に払い出すチケットID */
  nextId: number;
  tickets: Ticket[];
  /** 次に払い出す案件ID */
  nextProjectId: number;
  /** 案件マスター（表示順は登録順） */
  projects: Project[];
}
