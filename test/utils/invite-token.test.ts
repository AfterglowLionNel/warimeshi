import { describe, it, expect } from "vitest";
import { generateInviteToken } from "@/lib/utils/invite-token";

describe("generateInviteToken", () => {
  it("12 文字のトークンを返す", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(12);
  });

  it("紛らわしい文字 (0, O, 1, I, l) を含まない", () => {
    // 1000 回生成して全件に対して紛らわしい文字が無いことを確認
    for (let i = 0; i < 1000; i++) {
      const token = generateInviteToken();
      expect(token).not.toMatch(/[0OIl1]/);
    }
  });

  it("英数字のみ", () => {
    for (let i = 0; i < 100; i++) {
      const token = generateInviteToken();
      expect(token).toMatch(/^[A-Za-z2-9]+$/);
    }
  });

  it("毎回ユニーク (衝突確率はエントロピー的に非常に低い)", () => {
    const set = new Set<string>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      set.add(generateInviteToken());
    }
    // 1 万回試行で衝突 0 を期待する (約 83.5 bit のエントロピー)
    expect(set.size).toBe(N);
  });

  it("文字種の分布が偏っていない (Math.random では無いことの検査)", () => {
    // 各文字種の出現頻度を集計
    const counts = new Map<string, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      for (const ch of generateInviteToken()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    // 56 字 × 12 文字 = 672000 / N=10000 → 各字平均 213.75 回
    // 統計的に最頻字が平均の 2 倍を超えるなら偏りあり (CSPRNG ならまず起きない)
    const values = [...counts.values()];
    const max = Math.max(...values);
    const avg = (12 * N) / 56;
    expect(max).toBeLessThan(avg * 2);
  });
});
