import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Sliding-window レート制限。
//
// 環境変数 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されている場合は
// Upstash Redis (@upstash/ratelimit) を使う。複数プロセス・本番デプロイで正しく動く。
// 設定が無い場合 (dev / test) は in-memory フォールバックを使う。

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

// ---------- Upstash バックエンド ----------

let upstashRedis: Redis | null | undefined;

function getUpstashRedis(): Redis | null {
  if (upstashRedis !== undefined) return upstashRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashRedis = null;
    return null;
  }
  upstashRedis = new Redis({ url, token });
  return upstashRedis;
}

// Ratelimit インスタンスは (max, windowSec) ごとにキャッシュする。
const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(opts: RateLimitOptions): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  const cacheKey = `${opts.max}:${opts.windowSec}`;
  const cached = ratelimitCache.get(cacheKey);
  if (cached) return cached;

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.max, `${opts.windowSec} s`),
    prefix: "wm-rl",
    analytics: false,
  });
  ratelimitCache.set(cacheKey, rl);
  return rl;
}

// ---------- in-memory フォールバック ----------

function rateLimitInMemory(key: Key, opts: RateLimitOptions): RateLimitResult {
  ensureSweeper();
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const cutoff = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
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

// ---------- 公開 API ----------

/**
 * `key` に対し sliding window で rate limit を判定する。
 * 同じ key + windowSec で複数回呼ぶと累積する。
 *
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていれば Redis を使う。
 * そうでない場合は in-memory バックエンド (単一プロセス前提) を使う。
 */
export async function rateLimit(key: Key, opts: RateLimitOptions): Promise<RateLimitResult> {
  const rl = getRatelimit(opts);
  if (rl) {
    const r = await rl.limit(key);
    return {
      allowed: r.success,
      remaining: Math.max(0, r.remaining),
      retryAfterSec: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
    };
  }
  return rateLimitInMemory(key, opts);
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
