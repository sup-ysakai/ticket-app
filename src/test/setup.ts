// テスト共通の初期設定
//
// jsdom 環境では AbortSignal が jsdom のもの、Request が Node.js のものになり、
// React Router（データルーター）が内部で Request を作る際に
// 「Expected signal to be an instance of AbortSignal」というエラーになる。
// このアプリはデータの読み込み処理（loader）を使っておらず signal は不要なため、
// テスト環境に限り signal を渡さない Request に置き換える。

if (typeof window !== 'undefined' && typeof globalThis.Request === 'function') {
  const NativeRequest = globalThis.Request;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init?.signal) {
        const { signal: _signal, ...rest } = init;
        super(input, rest);
      } else {
        super(input, init);
      }
    }
  } as typeof Request;
}
