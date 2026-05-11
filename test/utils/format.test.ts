import { describe, it, expect } from "vitest";
import { formatCurrency, parseCurrency } from "@/lib/utils/format";

describe("formatCurrency", () => {
  it("正常な金額を ¥ + カンマ区切りで返す", () => {
    expect(formatCurrency(0)).toBe("¥0");
    expect(formatCurrency(100)).toBe("¥100");
    expect(formatCurrency(1000)).toBe("¥1,000");
    expect(formatCurrency(1234567)).toBe("¥1,234,567");
  });

  it("負の金額も扱える", () => {
    expect(formatCurrency(-500)).toBe("¥-500");
    expect(formatCurrency(-1234)).toBe("¥-1,234");
  });

  it("null / undefined / NaN は ¥0 を返す", () => {
    expect(formatCurrency(null)).toBe("¥0");
    expect(formatCurrency(undefined)).toBe("¥0");
    expect(formatCurrency(Number.NaN)).toBe("¥0");
  });

  it("小数は toLocaleString に従う", () => {
    expect(formatCurrency(0.5)).toBe("¥0.5");
  });
});

describe("parseCurrency", () => {
  it("¥ とカンマを除いた数値を返す", () => {
    expect(parseCurrency("¥1,234")).toBe(1234);
    expect(parseCurrency("¥0")).toBe(0);
    expect(parseCurrency("1000")).toBe(1000);
  });

  it("数値として読めない場合は 0", () => {
    expect(parseCurrency("")).toBe(0);
    expect(parseCurrency("abc")).toBe(0);
    expect(parseCurrency("¥")).toBe(0);
  });

  it("カンマ以外の区切り文字は parseInt に従う (頭の数字部分を取る)", () => {
    expect(parseCurrency("¥1,234.50")).toBe(1234);
    expect(parseCurrency("¥1,234円")).toBe(1234);
  });
});
