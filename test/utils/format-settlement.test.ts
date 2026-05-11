import { describe, it, expect } from "vitest";
import {
  formatEventDate,
  formatSettlement,
  type SettlementEntry,
  type SettlementBreakdownMember,
  type SettlementMemberSummary,
} from "@/lib/utils/format-settlement";

describe("formatEventDate", () => {
  it("YYYY-MM-DD を ja-JP 形式に整形", () => {
    const out = formatEventDate("2026-05-12");
    // 環境ロケールの差を吸収するため、年月日数字と曜日が含まれているかだけ確認
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/05/);
    expect(out).toMatch(/12/);
  });

  it("ISO8601 文字列も扱える", () => {
    const out = formatEventDate("2026-05-12T10:00:00.000Z");
    expect(out).toMatch(/2026/);
  });

  it("null / undefined / 空文字は null", () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate(undefined)).toBeNull();
    expect(formatEventDate("")).toBeNull();
  });

  it("解釈不能な値は元の文字列を返す", () => {
    expect(formatEventDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatSettlement", () => {
  const entries: SettlementEntry[] = [
    { memberName: "太郎", amount: 1000, isPaid: false },
    { memberName: "花子", amount: 1500, isPaid: true },
  ];

  it("最小ケース: タイトル/1人あたり/支払い行", () => {
    const out = formatSettlement("飲み会", 1250, entries);
    expect(out).toContain("【飲み会】割り勘結果");
    expect(out).toContain("1人あたり: ¥1,250");
    expect(out).toContain("☐ 太郎: ¥1,000");
    expect(out).toContain("✓ 花子: ¥1,500");
    expect(out).toContain("warimeshiで計算しました");
  });

  it("totalAmount オプションがあると 1人あたり ではなく 合計 を表示", () => {
    const out = formatSettlement("X", 1250, entries, { totalAmount: 2500 });
    expect(out).toContain("合計: ¥2,500");
    expect(out).not.toContain("1人あたり:");
  });

  it("payerName があると 会計する人 行と矢印先名が入る", () => {
    const out = formatSettlement("X", 0, entries, { payerName: "幹事" });
    expect(out).toContain("会計する人: 幹事");
    expect(out).toContain("太郎 → 幹事: ¥1,000");
    expect(out).toContain("花子 → 幹事: ¥1,500");
  });

  it("memberSummaries を渡すと 各自の金額 セクションが付く", () => {
    const summaries: SettlementMemberSummary[] = [
      { memberName: "太郎", amount: 1000, isPayer: false },
      { memberName: "花子", amount: 1500, isPayer: true },
    ];
    const out = formatSettlement("X", 0, entries, { memberSummaries: summaries });
    expect(out).toContain("各自の金額");
    expect(out).toContain("・太郎: ¥1,000");
    expect(out).toContain("・花子（会計する人）: ¥1,500");
  });

  it("entries が空のときは 支払いなし", () => {
    const out = formatSettlement("X", 0, []);
    expect(out).toContain("支払い");
    expect(out).toContain("支払いなし");
  });

  it("adjustmentSummary があれば 調整 セクションを追加", () => {
    const out = formatSettlement("X", 0, entries, { adjustmentSummary: "ラッキーディスカウント: 太郎 -300円" });
    expect(out).toContain("調整");
    expect(out).toContain("・ラッキーディスカウント: 太郎 -300円");
  });

  it("breakdowns があれば 食べた内訳 セクションを追加", () => {
    const breakdowns: SettlementBreakdownMember[] = [
      {
        memberName: "太郎",
        totalAmount: 1000,
        items: [
          { itemName: "ビール", quantity: 2, amount: 600 },
          { itemName: "枝豆", quantity: 1, amount: 400 },
        ],
      },
      {
        memberName: "花子",
        totalAmount: 0,
        items: [],
      },
    ];
    const out = formatSettlement("X", 0, entries, { breakdowns });
    expect(out).toContain("食べた内訳");
    expect(out).toContain("太郎 小計 ¥1,000");
    expect(out).toContain("・ビール x2 ¥600");
    expect(out).toContain("・枝豆 ¥400"); // quantity=1 のときは表示しない
    expect(out).toContain("花子 小計 ¥0");
    expect(out).toContain("・注文なし");
  });

  it("eventDate を渡すと 日付 行が入る", () => {
    const out = formatSettlement("X", 0, entries, { eventDate: "2026-05-12" });
    expect(out).toMatch(/日付:.*2026/);
  });

  it("複数オプションの組み合わせで全セクションが正しい順序で出る", () => {
    const out = formatSettlement("総会", 1000, entries, {
      eventDate: "2026-05-12",
      totalAmount: 2500,
      payerName: "幹事",
      memberSummaries: [{ memberName: "太郎", amount: 1000, isPayer: false }],
      adjustmentSummary: "10円単位に切り上げ",
      breakdowns: [{ memberName: "太郎", totalAmount: 1000, items: [] }],
    });
    const idxTitle = out.indexOf("【総会】");
    const idxDate = out.indexOf("日付:");
    const idxTotal = out.indexOf("合計:");
    const idxPayer = out.indexOf("会計する人:");
    const idxSummary = out.indexOf("各自の金額");
    const idxPayments = out.indexOf("支払い\n");
    const idxAdj = out.indexOf("調整");
    const idxBreak = out.indexOf("食べた内訳");
    const idxFooter = out.indexOf("warimeshiで計算しました");
    expect(idxTitle).toBeLessThan(idxDate);
    expect(idxDate).toBeLessThan(idxTotal);
    expect(idxTotal).toBeLessThan(idxPayer);
    expect(idxPayer).toBeLessThan(idxSummary);
    expect(idxSummary).toBeLessThan(idxPayments);
    expect(idxPayments).toBeLessThan(idxAdj);
    expect(idxAdj).toBeLessThan(idxBreak);
    expect(idxBreak).toBeLessThan(idxFooter);
  });
});
