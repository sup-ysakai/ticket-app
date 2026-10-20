import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as projectService from '../lib/projectService';
import * as service from '../lib/ticketService';
import {
  STORAGE_KEY,
  exportStoreJson,
  loadLastBackupTime,
  loadRestorePoint,
  loadStore,
  recordBackupTime,
  saveRestorePoint,
  saveStore,
  type RestorePoint,
  type StorageLike,
} from '../storage/ticketStorage';
import type { Project, ProjectInput, Ticket, TicketInput, TicketStatus, TicketStore } from '../types/ticket';

interface TicketContextValue {
  /** ゴミ箱に入っていないチケット（一覧・ボード・ダッシュボードはこれを使う） */
  tickets: Ticket[];
  /** ゴミ箱内のチケット（ゴミ箱に移動した日時が新しい順） */
  trashedTickets: Ticket[];
  /** 案件マスター（登録順） */
  projects: Project[];
  /** 案件IDから案件を取得する（見つからなければ undefined） */
  getProject: (id: number | null) => Project | undefined;
  /** 案件ごとのチケット件数（ゴミ箱内は除く） */
  projectTicketCounts: Map<number, number>;
  createProject: (input: ProjectInput) => Project;
  updateProject: (id: number, input: ProjectInput) => Project;
  /** 案件を削除し、その案件を設定していたチケットを「案件なし」にする（戻り値は影響したチケット数） */
  deleteProject: (id: number) => number;
  /** 起動時の読み込みで問題があった場合のメッセージ */
  loadError: string | null;
  /** ゴミ箱に入っていないチケットを取得する */
  getTicket: (id: number) => Ticket | undefined;
  createTicket: (input: TicketInput) => Ticket;
  updateTicket: (id: number, input: TicketInput) => Ticket;
  updateMemo: (id: number, memo: string) => Ticket;
  changeStatus: (id: number, status: TicketStatus) => Ticket;
  moveToTrash: (id: number) => Ticket;
  restoreTicket: (id: number) => Ticket;
  /** 完全に削除する */
  deleteTicket: (id: number) => void;
  emptyTrash: () => void;
  /**
   * バックアップから復元する。現在のデータを退避してから置き換える。
   * 退避に失敗した場合は置き換えずに例外を投げる。
   */
  restoreFromBackup: (store: TicketStore) => void;
  /** 直近の復元前に退避したデータ（なければ null） */
  restorePoint: RestorePoint | null;
  /** 退避したデータに戻す（直前の復元を取り消す） */
  revertToRestorePoint: () => void;
  exportJson: () => string;
  /** 最終バックアップ日時（ISO 8601。記録がなければ null） */
  lastBackupAt: string | null;
  /** バックアップを作成したことを記録する（記録できたら true） */
  markBackedUp: () => boolean;
}

const TicketContext = createContext<TicketContextValue | null>(null);

interface TicketProviderProps {
  children: ReactNode;
  /** 保存先（省略時はブラウザの localStorage） */
  storage?: StorageLike;
}

/**
 * チケットデータを保持し、変更のたびに保存する。
 * 保存に失敗した場合は画面の状態を変更せず例外を投げる（画面と保存データの不一致を防ぐ）。
 */
export function TicketProvider({ children, storage = window.localStorage }: TicketProviderProps) {
  const [initial] = useState(() => loadStore(storage));
  const [store, setStore] = useState<TicketStore>(initial.store);
  // 連続操作でも最新の状態を基に更新するため ref でも保持する
  const storeRef = useRef(store);
  const [restorePoint, setRestorePoint] = useState<RestorePoint | null>(() => loadRestorePoint(storage));
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => loadLastBackupTime(storage));

  const commit = useCallback(
    (next: TicketStore) => {
      saveStore(storage, next);
      storeRef.current = next;
      setStore(next);
    },
    [storage],
  );

  // 別タブで変更された場合に表示を最新化する
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const result = loadStore(storage);
      if (!result.error) {
        storeRef.current = result.store;
        setStore(result.store);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storage]);

  const value = useMemo<TicketContextValue>(() => {
    const apply = (result: { store: TicketStore; ticket: Ticket }) => {
      commit(result.store);
      return result.ticket;
    };
    const tickets = store.tickets.filter((t) => !service.isTrashed(t));
    const trashedTickets = store.tickets
      .filter(service.isTrashed)
      .sort((a, b) => Date.parse(b.deletedAt ?? '') - Date.parse(a.deletedAt ?? ''));
    const projectMap = new Map(store.projects.map((p) => [p.id, p]));
    return {
      tickets,
      trashedTickets,
      projects: store.projects,
      getProject: (id) => (id === null ? undefined : projectMap.get(id)),
      projectTicketCounts: projectService.countTicketsByProject(store),
      createProject: (input) => {
        const result = projectService.createProject(storeRef.current, input);
        commit(result.store);
        return result.project;
      },
      updateProject: (id, input) => {
        const result = projectService.updateProject(storeRef.current, id, input);
        commit(result.store);
        return result.project;
      },
      deleteProject: (id) => {
        const result = projectService.deleteProject(storeRef.current, id);
        commit(result.store);
        return result.affected;
      },
      loadError: initial.error,
      getTicket: (id) => tickets.find((t) => t.id === id),
      createTicket: (input) => apply(service.createTicket(storeRef.current, input)),
      updateTicket: (id, input) => apply(service.updateTicket(storeRef.current, id, input)),
      updateMemo: (id, memo) => apply(service.updateMemo(storeRef.current, id, memo)),
      changeStatus: (id, status) => apply(service.changeStatus(storeRef.current, id, status)),
      moveToTrash: (id) => apply(service.moveToTrash(storeRef.current, id)),
      restoreTicket: (id) => apply(service.restoreTicket(storeRef.current, id)),
      deleteTicket: (id) => commit(service.deleteTicket(storeRef.current, id)),
      emptyTrash: () => commit(service.emptyTrash(storeRef.current)),
      restoreFromBackup: (next) => {
        // 退避 → 置き換えの順。退避に失敗したらここで例外となり、現在のデータは変更されない
        const point = saveRestorePoint(storage, storeRef.current);
        setRestorePoint(point);
        commit(next);
      },
      restorePoint,
      revertToRestorePoint: () => {
        if (!restorePoint) throw new Error('戻せる復元前のデータがありません。');
        commit(restorePoint.store);
      },
      exportJson: () => exportStoreJson(storeRef.current),
      lastBackupAt,
      markBackedUp: () => {
        const now = new Date();
        const ok = recordBackupTime(storage, now);
        if (ok) setLastBackupAt(now.toISOString());
        return ok;
      },
    };
  }, [store, commit, initial.error, storage, restorePoint, lastBackupAt]);

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets(): TicketContextValue {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error('useTickets は TicketProvider の内側で使用してください。');
  return ctx;
}
