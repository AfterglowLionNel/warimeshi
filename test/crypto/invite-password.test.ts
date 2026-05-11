import { describe, it, expect, beforeEach, afterEach } from "vitest";

// 注意: invite-password.ts は読み込み時に環境変数を見るわけではなく、関数呼び出し時に見る。
// よってテストごとに env を切り替え可能。
const TEST_SECRET = "test-secret-base64-32bytes-12345";
const ANOTHER_SECRET = "another-secret-base64-32bytes-678";
const LEGACY_AUTH_SECRET = "legacy-auth-secret-32bytes-1234";

describe("invite-password (AES-256-GCM)", () => {
  let originalInvite: string | undefined;
  let originalAuth: string | undefined;

  beforeEach(() => {
    originalInvite = process.env.INVITE_PASSWORD_SECRET;
    originalAuth = process.env.AUTH_SECRET;
    process.env.INVITE_PASSWORD_SECRET = TEST_SECRET;
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    process.env.INVITE_PASSWORD_SECRET = originalInvite;
    process.env.AUTH_SECRET = originalAuth;
  });

  it("encrypt → decrypt のラウンドトリップが一致する", async () => {
    const { encryptInvitePassword, decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const plain = "my-secret-password-123";
    const enc = encryptInvitePassword(plain);
    expect(decryptInvitePassword(enc)).toBe(plain);
  });

  it("暗号文は enc:v2: プレフィックスを持つ", async () => {
    const { encryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const enc = encryptInvitePassword("p");
    expect(enc.startsWith("enc:v2:")).toBe(true);
  });

  it("同じ平文を 2 回暗号化しても異なる暗号文 (IV ランダム)", async () => {
    const { encryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const plain = "same";
    const e1 = encryptInvitePassword(plain);
    const e2 = encryptInvitePassword(plain);
    expect(e1).not.toBe(e2);
  });

  it("isEncryptedInvitePassword は v2 / v1 形式を判定", async () => {
    const { isEncryptedInvitePassword, encryptInvitePassword } = await import("@/lib/crypto/invite-password");
    expect(isEncryptedInvitePassword(encryptInvitePassword("x"))).toBe(true);
    expect(isEncryptedInvitePassword("enc:legacy-format")).toBe(true);
    expect(isEncryptedInvitePassword("plain-text")).toBe(false);
    expect(isEncryptedInvitePassword("")).toBe(false);
  });

  it("decryptInvitePassword は暗号化されていない文字列に null を返す", async () => {
    const { decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    expect(decryptInvitePassword("not-encrypted")).toBeNull();
  });

  it("改竄された暗号文は null (GCM 認証タグ検証で失敗)", async () => {
    const { encryptInvitePassword, decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const enc = encryptInvitePassword("hello");
    // ciphertext 部分の 1 文字を変える (base64 部分)
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-1);
    expect(decryptInvitePassword(tampered)).toBeNull();
  });

  it("短すぎる暗号文は null", async () => {
    const { decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    expect(decryptInvitePassword("enc:v2:abc")).toBeNull();
  });

  it("空文字を暗号化できる", async () => {
    const { encryptInvitePassword, decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const enc = encryptInvitePassword("");
    expect(decryptInvitePassword(enc)).toBe("");
  });

  it("Unicode (日本語) を扱える", async () => {
    const { encryptInvitePassword, decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    const plain = "ぱすわーど🔐";
    const enc = encryptInvitePassword(plain);
    expect(decryptInvitePassword(enc)).toBe(plain);
  });

  it("INVITE_PASSWORD_SECRET 未設定だと encrypt が throw", async () => {
    delete process.env.INVITE_PASSWORD_SECRET;
    const { encryptInvitePassword } = await import("@/lib/crypto/invite-password");
    expect(() => encryptInvitePassword("x")).toThrow(/INVITE_PASSWORD_SECRET/);
  });

  it("異なる鍵では復号できない (null を返す)", async () => {
    // 1) TEST_SECRET で暗号化
    const m1 = await import("@/lib/crypto/invite-password");
    const enc = m1.encryptInvitePassword("hello");

    // 2) 別の鍵に切り替え (キャッシュをクリアする必要があるので、
    //    INVITE_PASSWORD_SECRET を変える + モジュールを再 import)
    process.env.INVITE_PASSWORD_SECRET = ANOTHER_SECRET;
    // モジュール内 cachedKeys が secret 込みでキーキャッシュしているので、
    // 同一モジュールでも別鍵での復号は失敗する。
    expect(m1.decryptInvitePassword(enc)).toBeNull();
  });

  it("レガシー v1 (enc:) は AUTH_SECRET 派生鍵でも試行される", async () => {
    // v1 と同形式の (enc: prefix + IV/TAG/CT 構造) を AUTH_SECRET 派生鍵で作って、
    // decryptInvitePassword が AUTH_SECRET にもフォールバックすることを確認する。
    process.env.AUTH_SECRET = LEGACY_AUTH_SECRET;
    const { createHash, createCipheriv, randomBytes } = await import("node:crypto");
    const key = createHash("sha256").update(LEGACY_AUTH_SECRET).update(":invite-password:v1").digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update("legacy", "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacy = "enc:" + Buffer.concat([iv, tag, ct]).toString("base64");

    const { decryptInvitePassword } = await import("@/lib/crypto/invite-password");
    expect(decryptInvitePassword(legacy)).toBe("legacy");
  });
});
