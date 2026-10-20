import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';

interface UnsavedChangesGuard {
  /** 保存に成功した直後の画面移動など、確認せずに移動してよい場合に呼ぶ */
  allowNavigation: () => void;
  /** allowNavigation を取り消す（保存に失敗した場合など） */
  resetAllowNavigation: () => void;
  /** 画面移動を止めたときに表示する確認ダイアログ（描画する位置に置く） */
  prompt: ReactNode;
}

/**
 * 未保存の変更がある間、画面移動とブラウザのタブを閉じる操作・再読み込みの前に確認する。
 * - アプリ内の画面移動：確認ダイアログを表示し、「破棄して移動」を選んだ場合だけ移動する
 * - タブを閉じる・再読み込み：ブラウザ標準の確認を表示する
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  // 画面移動の判定は移動時点の値で行うため、最新の状態を ref で参照する
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypassRef = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      !bypassRef.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
    [],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 古いブラウザ向け（文言はブラウザ標準のものが表示される）
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const cancel = useCallback(() => blocker.reset?.(), [blocker]);

  const prompt = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="保存していない変更があります"
      confirmLabel="変更を破棄して移動"
      danger
      onConfirm={() => blocker.proceed?.()}
      onCancel={cancel}
    >
      <p>
        このまま移動すると、入力した内容は保存されずに失われます。
        <br />
        保存する場合は「キャンセル」を押して画面に戻り、保存してください。
      </p>
    </ConfirmDialog>
  );

  return {
    allowNavigation: () => {
      bypassRef.current = true;
    },
    resetAllowNavigation: () => {
      bypassRef.current = false;
    },
    prompt,
  };
}
