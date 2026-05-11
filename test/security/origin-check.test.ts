import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSameOriginRequest, requireSameOrigin } from "@/lib/security/origin-check";

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("origin-check", () => {
  let origNodeEnv: string | undefined;
  let origAuthUrl: string | undefined;
  let origSiteUrl: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origAuthUrl = process.env.AUTH_URL;
    origSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    if (origAuthUrl !== undefined) process.env.AUTH_URL = origAuthUrl;
    else delete process.env.AUTH_URL;
    if (origSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = origSiteUrl;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("isSameOriginRequest", () => {
    it("自身のオリジンと一致する Origin ヘッダなら許可", () => {
      const req = makeRequest("https://warimeshi.com/api/orders", {
        origin: "https://warimeshi.com",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("AUTH_URL のオリジンも許可", () => {
      process.env.AUTH_URL = "https://warimeshi.com";
      const req = makeRequest("https://internal.warimeshi.com/api/x", {
        origin: "https://warimeshi.com",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("NEXT_PUBLIC_SITE_URL のオリジンも許可", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://warimeshi.com";
      const req = makeRequest("https://internal.example/api/x", {
        origin: "https://warimeshi.com",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("別オリジンの Origin は拒否", () => {
      const req = makeRequest("https://warimeshi.com/api/orders", {
        origin: "https://evil.com",
      });
      expect(isSameOriginRequest(req)).toBe(false);
    });

    it("Origin が無く Referer がある場合は Referer のオリジンで判定", () => {
      const req = makeRequest("https://warimeshi.com/api/orders", {
        referer: "https://warimeshi.com/group/table/abc",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("Origin が無く Referer が別オリジンなら拒否", () => {
      const req = makeRequest("https://warimeshi.com/api/orders", {
        referer: "https://evil.com/exploit",
      });
      expect(isSameOriginRequest(req)).toBe(false);
    });

    it("Origin も Referer も無いと拒否 (CSRF と見做す)", () => {
      const req = makeRequest("https://warimeshi.com/api/orders");
      expect(isSameOriginRequest(req)).toBe(false);
    });

    it("x-forwarded-proto / x-forwarded-host で自身のオリジンを判定する", () => {
      // 内部接続は http://localhost:3001 だが、外から見ると https://warimeshi.com
      const req = makeRequest("http://localhost:3001/api/orders", {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "warimeshi.com",
        origin: "https://warimeshi.com",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("development では localhost が許可される", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      const req = makeRequest("http://anywhere/api", {
        origin: "http://localhost:3000",
      });
      expect(isSameOriginRequest(req)).toBe(true);
    });

    it("production では localhost は許可されない (env 設定が無い場合)", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.AUTH_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      const req = makeRequest("https://warimeshi.com/api", {
        origin: "http://localhost:3000",
      });
      expect(isSameOriginRequest(req)).toBe(false);
    });
  });

  describe("requireSameOrigin", () => {
    it("同一オリジンなら null を返す", () => {
      const req = makeRequest("https://warimeshi.com/api/x", {
        origin: "https://warimeshi.com",
      });
      expect(requireSameOrigin(req)).toBeNull();
    });

    it("異オリジンなら 403 NextResponse を返す", async () => {
      const req = makeRequest("https://warimeshi.com/api/x", {
        origin: "https://evil.com",
      });
      const res = requireSameOrigin(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(403);
      const body = await res?.json();
      expect(body.error).toBe("Forbidden");
    });
  });
});
