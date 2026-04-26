// シンプルな in-memory sliding window レート制限。
// 単一プロセス前提 (Next.js dev / pm2 単一インスタンス)。
// 複数インスタンス本番では Redis などに置き換えること。

type Key = string;

interface Bucket {
  // 各エントリは UNIX ms タイムスタンプ
  hits: number[];
}

const buckets = new Map<Key, Bucket>();

// 定期的に古いエントリを掃除 (起動時に 1 度だけタイマーをセット)
let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  // 5 分ごとに 1 時間以上前のエントリを削除
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, b] of buckets) {
      const fresh = b.hits.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(k);
      else b.hits = fresh;
    }
  }, 5 * 60 * 1000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  /** 残りの許容回数 (allowed=true 時のみ有効) */
  remaining: number;
  /** 次に再試行できるまでの秒数 (allowed=false 時に意味あり) */
  retryAfterSec: number;
}

export interface RateLimitOptions {
  /** ウィンドウ幅 (秒) */
  windowSec: number;
  /** ウィンドウ内の最大ヒット数 */
  max: number;
}

/**
 * `key` に対し sliding window で rate limit を判定する。
 * 同じ key + windowSec で複数回呼ぶと累積する。
 */
export function rateLimit(key: Key, opts: RateLimitOptions): RateLimitResult {
  ensureSweeper();
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const cutoff = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
  // 古いヒットを落とす
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.max) {
    const oldest = bucket.hits[0];
    const retryAfterMs = oldest + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: opts.max - bucket.hits.length,
    retryAfterSec: 0,
  };
}

/** クライアント識別子: x-forwarded-for の最初の IP、無ければ "unknown" */
export function clientKey(request: Request, prefix: string): string {
  const xff = request.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${prefix}:${ip}`;
}

/** 失敗時に 429 を返すための共通ヘルパー (NextResponse から呼ぶ用) */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfterSec),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}
