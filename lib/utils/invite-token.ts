import "server-only";

import { randomBytes } from "node:crypto";

// 招待トークン生成は CSPRNG (crypto.randomBytes) を使う。
// Math.random() は予測可能で、トークンだけで passwordless テーブルへの参加を
// 許してしまう構造のため不可。
//
// 紛らわしい文字 (0/O, 1/I/l) を避けた 56 字のアルファベット。
// 12 文字で約 6.96 ビット × 12 ≈ 83.5 ビットのエントロピー。
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateInviteToken(): string {
  const buf = randomBytes(12);
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += CHARS.charAt(buf[i] % CHARS.length);
  }
  return token;
}
