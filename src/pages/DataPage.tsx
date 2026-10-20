import { useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Page } from '../components/Page';
import { diffInDays, formatDateTime, todayString } from '../lib/date';
import { getErrorMessage } from '../lib/errors';
import { isTrashed } from '../lib/ticketService';
import { STORAGE_KEY, exportStoreJson, readBackupJson, type BackupFileContent } from '../storage/ticketStorage';
import { useTickets } from '../state/TicketContext';
import { useToast } from '../state/ToastContext';
import type { TicketStore } from '../types/ticket';

/** しばらくバックアップしていないと警告する日数 */
const BACKUP_WARNING_DAYS = 7;

function backupFileName(now: Date, prefix = 'tickets-backup'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** ファイルを文字列として読み込む */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした。'));
    reader.readAsText(file);
  });
}

interface StoreCounts {
  total: number;
  active: number;
  trashed: number;
}

function countStore(store: TicketStore): StoreCounts {
  const trashed = store.tickets.filter(isTrashed).length;
  return { total: store.tickets.length, active: store.tickets.length - trashed, trashed };
}

function formatCounts(c: StoreCounts): string {
  return `${c.total}件（通常 ${c.active}件・ゴミ箱 ${c.trashed}件）`;
}

interface Result {
  type: 'success' | 'error';
  message: string;
}

/** バックアップ（エクスポート）と復元（インポート） */
export function DataPage() {
  const { tickets, trashedTickets, projects, exportJson, restoreFromBackup, restorePoint, revertToRestorePoint, lastBackupAt, markBackedUp } =
    useTickets();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ fileName: string; content: BackupFileContent } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState<'restore' | 'revert' | null>(null);

  const current: StoreCounts = {
    total: tickets.length + trashedTickets.length,
    active: tickets.length,
    trashed: trashedTickets.length,
  };
  const backupAgeDays = lastBackupAt ? diffInDays(todayString(new Date(lastBackupAt)), todayString()) : null;
  const backupStale = backupAgeDays === null || backupAgeDays >= BACKUP_WARNING_DAYS;

  const handleExport = () => {
    try {
      const fileName = backupFileName(new Date());
      downloadText(exportJson(), fileName);
      const recorded = markBackedUp();
      // ブラウザ側で実際に保存されたかは確認できないため「ダウンロードを開始」と表示する
      showToast(
        recorded
          ? `「${fileName}」のダウンロードを開始しました（${current.total}件）。`
          : `「${fileName}」のダウンロードを開始しました。ただし、最終バックアップ日時は記録できませんでした。`,
        recorded ? 'success' : 'info',
      );
    } catch (e) {
      showToast(`バックアップに失敗しました：${getErrorMessage(e)}`, 'error');
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを再選択できるようにする
    if (!file) return;
    setPreview(null);
    setResult(null);
    try {
      // 検証のみ行う。この時点では保存データを一切変更しない
      const content = readBackupJson(await readFileText(file));
      setPreview({ fileName: file.name, content });
    } catch (err) {
      setResult({
        type: 'error',
        message: `「${file.name}」は復元に使えません。${getErrorMessage(err)} 現在のデータは変更されていません。`,
      });
    }
  };

  const confirmRestore = () => {
    setConfirming(null);
    if (!preview) return;
    const counts = countStore(preview.content.store);
    try {
      restoreFromBackup(preview.content.store);
      setResult({ type: 'success', message: `「${preview.fileName}」から ${formatCounts(counts)} を復元しました。` });
      showToast(`${counts.total}件のチケットを復元しました。`);
      setPreview(null);
    } catch (err) {
      setResult({
        type: 'error',
        message: `復元を中止しました。${getErrorMessage(err)} 現在のデータは変更されていません。`,
      });
    }
  };

  const confirmRevert = () => {
    setConfirming(null);
    if (!restorePoint) return;
    try {
      revertToRestorePoint();
      const counts = countStore(restorePoint.store);
      setResult({ type: 'success', message: `復元前の状態（${formatCounts(counts)}）に戻しました。` });
      showToast('復元前の状態に戻しました。');
    } catch (err) {
      setResult({ type: 'error', message: `復元前の状態に戻せませんでした。${getErrorMessage(err)}` });
    }
  };

  const downloadRestorePoint = () => {
    if (!restorePoint) return;
    try {
      downloadText(exportStoreJson(restorePoint.store), backupFileName(new Date(restorePoint.savedAt), 'tickets-before-restore'));
    } catch (e) {
      showToast(`ダウンロードに失敗しました：${getErrorMessage(e)}`, 'error');
    }
  };

  const previewCounts = preview ? countStore(preview.content.store) : null;

  return (
    <Page
      width="narrow"
      title="データ管理"
      documentTitle="データ管理"
      description="チケットデータの保存先の確認、バックアップ、復元を行います。"
    >
      <section className="card section-card" aria-labelledby="data-status">
        <h2 id="data-status" className="section-title">
          保存状況
        </h2>
        <dl className="kv-list">
          <div>
            <dt>保存先</dt>
            <dd>
              このブラウザの保存領域（localStorage）
              <br />
              <span className="muted small">
                保存キー：<code>{STORAGE_KEY}</code>
              </span>
            </dd>
          </div>
          <div>
            <dt>保存件数</dt>
            <dd>{formatCounts(current)}</dd>
          </div>
          <div>
            <dt>案件マスター</dt>
            <dd>{projects.length}件</dd>
          </div>
          <div>
            <dt>最終バックアップ</dt>
            <dd>
              {lastBackupAt ? (
                <>
                  {formatDateTime(lastBackupAt)}
                  <span className="muted small">（{backupAgeDays === 0 ? '今日' : `${backupAgeDays}日前`}）</span>
                </>
              ) : (
                'まだバックアップしていません'
              )}
            </dd>
          </div>
        </dl>
        {backupStale && (
          <div className="alert alert-warn">
            {lastBackupAt
              ? `${BACKUP_WARNING_DAYS}日以上バックアップしていません。`
              : 'バックアップの記録がありません。'}
            下の「バックアップをダウンロード」から保存しておくことをおすすめします。
          </div>
        )}
        <ul className="note-list">
          <li>入力・変更の内容は、その都度自動で保存されます。</li>
          <li>別のブラウザ・別のPC・シークレットウィンドウからは、同じデータは見えません。</li>
          <li>ブラウザの「閲覧履歴データの削除（Cookieとサイトデータ）」を行うと、データが消えます。</li>
        </ul>
      </section>

      <section className="card section-card" aria-labelledby="data-backup">
        <h2 id="data-backup" className="section-title">
          バックアップ（エクスポート）
        </h2>
        <p>
          すべてのチケット（ゴミ箱のチケットを含む {current.total}件）と案件マスター（{projects.length}件）をJSONファイルとしてダウンロードします。
          OneDrive など、PCの外にも残る場所に保存しておくと安心です。
        </p>
        <div className="section-actions">
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            バックアップをダウンロード
          </button>
        </div>
      </section>

      <section className="card section-card" aria-labelledby="data-restore">
        <h2 id="data-restore" className="section-title">
          復元（インポート）
        </h2>
        <ol className="step-list">
          <li>バックアップしたJSONファイルを選びます（この時点ではデータは変更されません）。</li>
          <li>ファイルの内容（作成日時・件数）を確認します。</li>
          <li>「この内容で復元する」を押すと、現在のデータがファイルの内容に置き換わります。</li>
        </ol>
        <p className="muted small">復元の直前に、現在のデータを自動で退避します。復元後に「復元前の状態に戻す」で元に戻せます。</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="restore-file"
          onChange={handleFile}
        />
        <div className="section-actions">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            バックアップファイルを選択…
          </button>
        </div>

        {result && (
          <div
            className={`alert ${result.type === 'success' ? 'alert-success' : 'alert-error'}`}
            role={result.type === 'success' ? 'status' : 'alert'}
          >
            {result.message}
          </div>
        )}

        {preview && previewCounts && (
          <div className="restore-preview" aria-label="復元する内容の確認">
            <h3 className="sub-title">復元する内容の確認</h3>
            <table className="compare-table">
              <thead>
                <tr>
                  <th />
                  <th>バックアップファイル</th>
                  <th>現在のデータ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>ファイル名・作成日時</th>
                  <td>
                    {preview.fileName}
                    <br />
                    <span className="muted small">
                      {preview.content.exportedAt ? formatDateTime(preview.content.exportedAt) : '作成日時の記録なし'}
                    </span>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <th>件数</th>
                  <td>{formatCounts(previewCounts)}</td>
                  <td>{formatCounts(current)}</td>
                </tr>
                <tr>
                  <th>案件マスター</th>
                  <td>{preview.content.store.projects.length}件</td>
                  <td>{projects.length}件</td>
                </tr>
              </tbody>
            </table>
            <div className="alert alert-warn">
              復元すると、現在の {current.total}件 はすべてバックアップファイルの内容に置き換わります。
            </div>
            <div className="section-actions">
              <button type="button" className="btn" onClick={() => setPreview(null)}>
                キャンセル
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirming('restore')}>
                この内容で復元する…
              </button>
            </div>
          </div>
        )}
      </section>

      {restorePoint && (
        <section className="card section-card" aria-labelledby="data-revert">
          <h2 id="data-revert" className="section-title">
            復元前の状態に戻す
          </h2>
          <p>
            {formatDateTime(restorePoint.savedAt)} に復元を行う直前のデータ（{formatCounts(countStore(restorePoint.store))}）を保持しています。
            直前の復元を取り消したいときに使います。
          </p>
          <div className="section-actions">
            <button type="button" className="btn" onClick={downloadRestorePoint}>
              このデータをファイルに保存
            </button>
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming('revert')}>
              復元前の状態に戻す…
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirming === 'restore'}
        title="データを復元しますか？"
        confirmLabel="置き換えて復元する"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setConfirming(null)}
      >
        <p>
          現在の {current.total}件 を、「{preview?.fileName}」の {previewCounts?.total}件 で置き換えます。
          <br />
          復元前のデータは自動で退避され、「復元前の状態に戻す」で戻せます。
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === 'revert'}
        title="復元前の状態に戻しますか？"
        confirmLabel="復元前の状態に戻す"
        danger
        onConfirm={confirmRevert}
        onCancel={() => setConfirming(null)}
      >
        <p>
          現在の {current.total}件 を、復元前に退避したデータで置き換えます。
          <br />
          現在のデータが必要な場合は、先にバックアップしてください。
        </p>
      </ConfirmDialog>
    </Page>
  );
}
