# warimeshi

飲み会や旅行の割り勘計算を簡単にするアプリ。注文別の金額管理、グループ共有、タクシー料金の割り勘に対応。

本番サイト: https://warimeshi.com

## 主な機能

- **注文別の割り勘** — 一人で頼んだ品・共有した品を分けて計算
- **グループ精算** — テーブルを作って招待リンクで共有、参加者と支払い状況を管理
- **タクシー料金の割り勘** — 区間ごとの降車を反映した按分計算
- **ログイン不要** — ゲストでもすぐ使える（Google / LINE アカウントで永続化も可）
- **PWA 対応** — ホーム画面に追加してオフラインでも閲覧可能

## 技術スタック

- [Next.js 16](https://nextjs.org/) (App Router)
- React 19 / TypeScript
- [Auth.js v5](https://authjs.dev/) — Google / LINE OAuth + ゲストセッション
- [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/)
- pnpm

## ローカル開発

### 前提

- Node.js 24+
- pnpm
- Docker Desktop（PostgreSQL 用）

### セットアップ

```bash
# 1. 環境変数を用意
cp .env.local.example .env.local   # 用意してから値を埋める

# 2. PostgreSQL コンテナを起動
docker compose up -d

# 3. 依存関係をインストール
pnpm install

# 4. 開発サーバーを起動
pnpm dev
```

http://localhost:3000 で起動します。

DB 接続情報（docker-compose 既定値）:
```
postgres://warimeshi:warimeshi@localhost:5432/warimeshi
```

### 必要な環境変数

`.env.local` に以下を設定してください。

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | Auth.js のセッション署名鍵 (`openssl rand -base64 32`) |
| `AUTH_URL` | 認証コールバックの公開URL |
| `INVITE_PASSWORD_SECRET` | 招待リンク用パスワードの暗号鍵 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_LINE_ID` / `AUTH_LINE_SECRET` | LINE OAuth |
| `NEXT_PUBLIC_SITE_URL` | 公開URL（リダイレクト用） |

## スクリプト

```bash
pnpm dev          # 開発サーバー (port 3000)
pnpm build        # 本番ビルド
pnpm start        # 本番サーバー
pnpm lint         # ESLint
pnpm deploy       # ビルド + デプロイ用チャンク修正

pnpm db:generate  # スキーマからマイグレーション生成
pnpm db:migrate   # マイグレーション適用
pnpm db:push      # スキーマを直接 DB に反映 (開発用)
pnpm db:studio    # Drizzle Studio
```

## ディレクトリ構成

```
app/         — Next.js App Router (ページ・API routes)
components/  — UI コンポーネント (group, taxi, landing, ui ...)
lib/         — DB スキーマ、認証、ユーティリティ
public/      — 静的アセット、PWA manifest
scripts/     — デプロイ・DB 関連スクリプト
```
