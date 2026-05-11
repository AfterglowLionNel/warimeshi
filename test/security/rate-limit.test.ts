import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Upstash の env を必ず外して、in-memory バックエンドの挙動を検証する。
describe("rate-limit (in-memory backend)", () => {
  let origUrl: string | undefined;
  let origToken: string | undefined;

  beforeEach(() => {
    origUrl = process.env.UPSTASH_REDIS_REST_URL;
    origToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // モジュール内に upstash の判定結果がキャッシュされているので、毎テスト reset する。
    vi.resetModules();
  });

  afterEach(() => {
    if (origUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = origUrl;
    if (origToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
  });

  it("max 以内なら allowed = true", async () => {
    const { rateLimit } = await import("@/lib/security/rate-limit");
    const r1 = await rateLimit("k1", { windowSec: 60, max: 3 });
    const r2 = await rateLimit("k1", { windowSec: 60, max: 3 });
    const r3 = await rateLimit("k1", { windowSec: 60, max: 3 });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("max を超えたら allowed = false で retryAfterSec が立つ", async () => {
    const { rateLimit } = await import("@/lib/security/rate-limit");
    await rateLimit("k2", { windowSec: 60, max: 2 });
    await rateLimit("k2", { windowSec: 60, max: 2 });
    const r3 = await rateLimit("k2", { windowSec: 60, max: 2 });
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterSec).toBeGreaterThan(0);
    expect(r3.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("別 key は独立カウンタ", async () => {
    const { rateLimit } = await import("@/lib/security/rate-limit");
    await rateLimit("kA", { windowSec: 60, max: 1 });
    const blockedA = await rateLimit("kA", { windowSec: 60, max: 1 });
    expect(blockedA.allowed).toBe(false);

    const okB = await rateLimit("kB", { windowSec: 60, max: 1 });
    expect(okB.allowed).toBe(true);
  });

  it("windowSec を過ぎたら再び許可される", async () => {
    vi.useFakeTimers();
    try {
      const { rateLimit } = await import("@/lib/security/rate-limit");
      await rateLimit("kT", { windowSec: 1, max: 1 });
      const blocked = await rateLimit("kT", { windowSec: 1, max: 1 });
      expect(blocked.allowed).toBe(false);

      // 2 秒進める
      vi.advanceTimersByTime(2000);

      const allowed = await rateLimit("kT", { windowSec: 1, max: 1 });
      expect(allowed.allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("clientKey", () => {
  it("x-forwarded-for の最初の IP を返す", async () => {
    const { clientKey } = await import("@/lib/security/rate-limit");
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(clientKey(req, "pref")).toBe("pref:203.0.113.1");
  });

  it("x-real-ip にフォールバックする", async () => {
    const { clientKey } = await import("@/lib/security/rate-limit");
    const req = new Request("https://x", {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    expect(clientKey(req, "p")).toBe("p:198.51.100.5");
  });

  it("どちらも無ければ unknown", async () => {
    const { clientKey } = await import("@/lib/security/rate-limit");
    const req = new Request("https://x");
    expect(clientKey(req, "p")).toBe("p:unknown");
  });
});

describe("rateLimitHeaders", () => {
  it("Retry-After と X-RateLimit-Remaining を返す", async () => {
    const { rateLimitHeaders } = await import("@/lib/security/rate-limit");
    const h = rateLimitHeaders({ allowed: false, remaining: 0, retryAfterSec: 42 });
    expect(h["Retry-After"]).toBe("42");
    expect(h["X-RateLimit-Remaining"]).toBe("0");
  });
});
