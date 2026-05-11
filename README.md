# warimeshi

[![CI](https://github.com/AfterglowLionNel/warimeshi/actions/workflows/ci.yml/badge.svg)](https://github.com/AfterglowLionNel/warimeshi/actions/workflows/ci.yml)

飲み会や旅行の割り勘計算をシンプルにする Web アプリ。
注文別の金額管理、グループ共有、タクシー料金の割り勘に対応。

本番サイト: **https://warimeshi.com**

---

## 主な機能

- **注文別の割り勘** — 一人で頼んだ品・共有した品を分けて計算
- **グループ精算** — テーブルを作って招待リンクで共有、参加者と支払い状況を管理
- **タクシー料金の割り勘** — 区間ごとの降車を反映した按分計算
- **ログイン不要** — ゲストでもすぐ使える（Google / LINE アカウントで永続化も可）
- **PWA 対応** — ホーム画面に追加、オフライン閲覧可能
- **リアルタイム同期** — Server-Sent Events で複数端末からの同時編集を反映

## 技術スタック

| 層 | 採用技術 | 選定理由 |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC によるデータ取得最適化、SEO 対応 |
| Language | TypeScript / React 19 | 型による安全性、最新の Concurrent 機能 |
| Styling | Tailwind CSS v4 + shadcn/ui | ユーティリティ駆動 + コピー可能な高品質コンポーネント |
| Auth | Auth.js v5 (next-auth) | OAuth (Google / LINE) + Drizzle Adapter |
| ORM | Drizzle ORM | 型推論ベース、SQL に近い API |
| DB | PostgreSQL | ACID トランザクションが必須の精算ロジック向き |
| Validation | Zod | サーバー側入力検証 (DTO 検証) |
| Real-time | Server-Sent Events | WebSocket 不要、HTTP/2 と相性◎ |
| Rate Limit | Upstash Redis (任意) | サーバーレス環境でも分散可能 |
| Test | Vitest | 高速、ESM ネイティブ |

## アーキテクチャ

```
                              ┌───────────────────────┐
  ブラウザ / PWA  ───────▶   │  Next.js App Router    │
                              │  - Server Components   │
                              │  - Route Handlers      │
                              │  - Server Actions      │
                              └───────────┬────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
   ┌──────────────────┐          ┌─────────────────┐         ┌─────────────────┐
   │ PostgreSQL       │          │ Upstash Redis   │         │ Google / LINE   │
   │ - users          │          │ - rate limit    │         │  OAuth Provider │
   │ - tables         │          │ (任意)          │         └─────────────────┘
   │ - orders         │          └─────────────────┘
   │ - payments       │
   │ - taxi_records   │
   └──────────────────┘
```

## セキュリティ設計

主要な防御は以下のとおりです。詳細は `lib/security/` と各 API route のコメントを参照。

| 領域 | 対策 |
|---|---|
| **認証** | Auth.js v5 + DrizzleAdapter / `allowDangerousEmailAccountLinking: false` 明示無効化でアカウントテイクオーバー対策 |
| **認可 (IDOR)** | `lib/auth/permissions.ts` の `isUserTableMember` / `isUserTableOwner` / `canModifyOrder` で全 mutating API に適用 |
| **CSRF** | SameSite=Lax Cookie + 全状態変更 API で `requireSameOrigin` による Origin/Host 二重検証 |
| **XSS** | CSP nonce + `strict-dynamic` (proxy.ts で動的生成) / `dangerouslySetInnerHTML` は静的 JSON-LD のみ |
| **SQL Injection** | Drizzle ORM のみ使用、生 SQL なし |
| **入力検証** | Zod スキーマで全 mutating API の body を検証 (length, type, enum 等) |
| **招待トークン** | `crypto.randomBytes` ベースの CSPRNG (12 文字 ≈ 83 bit エントロピー) |
| **招待パスワード** | AES-256-GCM (v2) + AUTH_SECRET 派生鍵への自動フォールバック (v1 互換) |
| **Server-only 分離** | DB / Auth / Crypto / Rate-limit に `import "server-only"` で client への混入を防止 |
| **DTO 最小化** | Server Component → Client Component で `is_admin` 等の機密属性を渡さない |
| **レート制限** | Upstash Redis (本番) / in-memory (dev) で IP × エンドポイント別に制限 |
| **HTTP ヘッダ** | X-Frame-Options: DENY / nosniff / strict Referrer-Policy / Permissions-Policy |
| **PII 漏洩抑止** | テーブルメンバー API では email / is_admin を返さず displayName のみ |

## ローカル開発

### 前提

- Node.js 24+
- pnpm 10+
- Docker Desktop（PostgreSQL 用）

### セットアップ

```bash
# 1. 環境変数を用意
cp .env.example .env.local
# .env.local を編集して値を埋める (AUTH_SECRET / INVITE_PASSWORD_SECRET は openssl rand -base64 32)

# 2. PostgreSQL コンテナを起動
docker compose up -d

# 3. 依存関係をインストール
pnpm install

# 4. DB スキーマを反映
pnpm db:push

# 5. 開発サーバーを起動
pnpm dev
```

http://localhost:3000 でアクセスできます。

DB 接続情報（docker-compose 既定値）:
```
postgres://warimeshi:warimeshi@localhost:5432/warimeshi
```

## スクリプト

```bash
pnpm dev              # 開発サーバー (port 3000)
pnpm build            # 本番ビルド
pnpm start            # 本番サーバー
pnpm lint             # ESLint
pnpm typecheck        # TypeScript 型チェック
pnpm test             # Vitest 単体テスト
pnpm test:watch       # Vitest watch モード
pnpm test:coverage    # カバレッジ計測
pnpm deploy           # ビルド + デプロイ用チャンク修正

pnpm db:generate      # スキーマからマイグレーション生成
pnpm db:migrate       # マイグレーション適用
pnpm db:push          # スキーマを直接 DB に反映 (開発用)
pnpm db:studio        # Drizzle Studio
```

## ディレクトリ構成

```
app/                  Next.js App Router (ページ・API routes)
├── api/              Route Handlers (REST)
├── auth/             認証ページ・コールバック
├── group/            グループ機能
├── solo/             ソロ機能 (履歴ベース)
└── taxi/             タクシー計算
components/           UI コンポーネント
├── group/            グループ機能の UI
├── taxi/             タクシー計算 UI
├── landing/          LP セクション
├── ui/               shadcn/ui コンポーネント
└── ...
lib/
├── auth/             Auth.js 設定 + 権限ロジック (server-only)
├── crypto/           招待パスワード AES-256-GCM 暗号化 (server-only)
├── db/               Drizzle ORM スキーマ + 接続 (server-only)
├── events/           SSE イベントバス (server-only)
├── security/         レート制限 + Origin 検証 (server-only)
├── types/            ドメイン型定義
├── utils/            純粋関数ユーティリティ (フォーマット等)
├── guest/            ゲストセッション (client + server)
└── hooks/            React Hooks
public/               静的アセット + PWA manifest
scripts/              デプロイ用 chunk 修正等
test/                 Vitest 単体テスト
.github/workflows/    CI (lint / typecheck / test)
```

## テスト

```bash
pnpm test
```

純粋関数 (`lib/utils/`, `lib/crypto/`, `lib/security/`) を中心にカバレッジ:

| モジュール | カバレッジ |
|---|---|
| `lib/utils/format.ts` | 100% |
| `lib/utils/format-settlement.ts` | 100% |
| `lib/utils/invite-token.ts` | 100% |
| `lib/crypto/invite-password.ts` | 98% |
| `lib/security/origin-check.ts` | 95% |
| `lib/security/rate-limit.ts` | 68% (Upstash 経路はモック化していないため) |

詳細は `pnpm test:coverage` で HTML レポートを参照。

## CI / CD

- GitHub Actions: `.github/workflows/ci.yml`
  - すべての push と PR で `lint` / `typecheck` / `test` を実行
- 本番デプロイ: systemd でホスト Next.js を起動 + Nginx でリバースプロキシ

## ライセンス

All Rights Reserved. 本リポジトリのコードを許可なく利用・複製・配布することは禁止します。
