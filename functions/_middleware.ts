// Cloudflare Pages Functions のミドルウェア：サイト全体に Basic 認証をかける。
// - 認証情報は環境変数 BASIC_AUTH_USER / BASIC_AUTH_PASSWORD から読む（コードには書かない）
// - 環境変数が未設定のときは、誤って誰でも見られる状態にならないよう 503 を返して公開しない
// - /robots.txt だけは認証なしで返す（検索エンジンに「クロールしない」指示を読ませるため）
// - すべての応答に noindex（X-Robots-Tag）と基本的な安全設定のヘッダーを付ける

export interface Env {
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
}

/** Pages Functions から渡される情報のうち、このミドルウェアで使う部分 */
export interface MiddlewareContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const REALM = 'ticket-app';

/** 認証なしで返すパス */
const PUBLIC_PATHS = new Set(['/robots.txt']);

/**
 * 文字列を、一致・不一致にかかわらず同じ手順で比較する。
 * ハッシュ値どうしを全バイト比較し、比較にかかる時間からパスワードを推測されにくくする。
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Authorization ヘッダー（Basic 方式）からユーザー名とパスワードを取り出す */
export function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim());
  if (!match) return null;
  let decoded: string;
  try {
    const binary = atob(match[1]);
    decoded = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const index = decoded.indexOf(':');
  if (index < 0) return null;
  return { user: decoded.slice(0, index), password: decoded.slice(index + 1) };
}

/** すべての応答に付けるヘッダー（検索エンジン対策と基本的な安全設定） */
function withCommonHeaders(response: Response): Response {
  // 取得した応答のヘッダーは変更できない場合があるため、複製してから設定する
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Referrer-Policy', 'no-referrer');
  return result;
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function onRequest({ request, env, next }: MiddlewareContext): Promise<Response> {
  if (PUBLIC_PATHS.has(new URL(request.url).pathname)) {
    return withCommonHeaders(await next());
  }

  const expectedUser = env.BASIC_AUTH_USER;
  const expectedPassword = env.BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return withCommonHeaders(
      textResponse(503, '認証の設定が完了していないため、表示できません。（環境変数 BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が未設定）'),
    );
  }

  const credentials = parseBasicAuth(request.headers.get('Authorization'));
  // ユーザー名とパスワードは両方とも比較する（片方だけ比較して早く終わると、時間差から推測されやすくなる）
  const userOk = await safeEqual(credentials?.user ?? '', expectedUser);
  const passwordOk = await safeEqual(credentials?.password ?? '', expectedPassword);
  if (!credentials || !userOk || !passwordOk) {
    return withCommonHeaders(
      textResponse(401, 'ユーザー名またはパスワードが正しくありません。', {
        'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      }),
    );
  }

  return withCommonHeaders(await next());
}
