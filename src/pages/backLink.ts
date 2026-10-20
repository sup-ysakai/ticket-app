// 詳細画面の「戻る」リンクの行き先を、開く前の画面（一覧の検索条件を含む）に合わせるための補助

/** 画面遷移時に引き継ぐ情報（どの画面から開いたか） */
export interface FromState {
  from?: string;
}

/** 現在の画面を「戻り先」として渡すための state を作る */
export function fromState(pathname: string, search = ''): FromState {
  return { from: pathname + search };
}

/** state から戻り先とリンクの文言を決める（不明な場合はチケット一覧） */
export function getBackLink(state: unknown): { to: string; label: string } {
  const from = typeof state === 'object' && state !== null ? (state as FromState).from : undefined;
  if (!from || !from.startsWith('/')) return { to: '/tickets', label: '一覧に戻る' };
  if (from === '/' || from.startsWith('/?')) return { to: from, label: 'ダッシュボードに戻る' };
  if (from.startsWith('/board')) return { to: from, label: 'ボードに戻る' };
  if (from.startsWith('/tickets')) return { to: from, label: '一覧に戻る' };
  return { to: '/tickets', label: '一覧に戻る' };
}
