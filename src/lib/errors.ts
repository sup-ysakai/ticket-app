/** 入力値の不備 */
export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketValidationError';
  }
}

/** 対象のチケットが存在しない */
export class TicketNotFoundError extends Error {
  constructor(id: number) {
    super(`チケット（ID: ${id}）が見つかりません。削除された可能性があります。`);
    this.name = 'TicketNotFoundError';
  }
}

/** 保存データの読み書きの失敗 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'StorageError';
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** 画面に表示するためのエラーメッセージを取り出す */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return '予期しないエラーが発生しました。';
}
