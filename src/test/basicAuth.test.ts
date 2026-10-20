// @vitest-environment node
// Cloudflare Pages Functions の Basic 認証ミドルウェアのテスト
// （functions フォルダ内のファイルはすべて公開URLとして扱われるため、テストは src 側に置く）

import { describe, expect, it } from 'vitest';
import { onRequest, parseBasicAuth, type Env } from '../../functions/_middleware';

// テスト専用の値（本番の認証情報ではない）
const ENV: Env = { BASIC_AUTH_USER: 'test-user', BASIC_AUTH_PASSWORD: 'test-pass' };

function basic(user: string, password: string): string {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

async function call(path: string, env: Env, authorization?: string) {
  const request = new Request(`https://example.pages.dev${path}`, {
    headers: authorization ? { Authorization: authorization } : {},
  });
  let nextCalled = false;
  const response = await onRequest({
    request,
    env,
    next: async () => {
      nextCalled = true;
      return new Response('アプリ本体', { status: 200 });
    },
  });
  return { response, nextCalled };
}

describe('Basic 認証ミドルウェア', () => {
  it('認証情報がない・誤っている場合は 401 を返し、アプリ本体は返さない', async () => {
    for (const auth of [undefined, basic('test-user', 'wrong'), basic('wrong', 'test-pass'), 'Bearer xxx', 'Basic !!!']) {
      const { response, nextCalled } = await call('/', ENV, auth);
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="ticket-app", charset="UTF-8"');
      expect(nextCalled).toBe(false);
    }
  });

  it('正しい認証情報ならアプリ本体を返し、noindex などのヘッダーを付ける', async () => {
    const { response, nextCalled } = await call('/tickets', ENV, basic('test-user', 'test-pass'));
    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('アプリ本体');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('環境変数が未設定なら、誰でも見られる状態にせず 503 を返す', async () => {
    for (const env of [{}, { BASIC_AUTH_USER: 'test-user' }, { BASIC_AUTH_PASSWORD: 'test-pass' }]) {
      const { response, nextCalled } = await call('/', env, basic('test-user', 'test-pass'));
      expect(response.status).toBe(503);
      expect(nextCalled).toBe(false);
    }
  });

  it('robots.txt だけは認証なしで返す（noindex ヘッダー付き）', async () => {
    const { response, nextCalled } = await call('/robots.txt', ENV);
    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('パスワードに「:」や日本語を含んでも正しく読み取る', () => {
    expect(parseBasicAuth(basic('ユーザー', 'a:b:日本語'))).toEqual({ user: 'ユーザー', password: 'a:b:日本語' });
    expect(parseBasicAuth(null)).toBeNull();
  });
});
