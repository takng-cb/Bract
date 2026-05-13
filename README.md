# Bract CRM

![CI](https://github.com/takng-cb/Bract-CRM/actions/workflows/ci.yml/badge.svg?branch=main)

業種オーバーレイ構造を持つ汎用 CRM。**同一コードベース (`main`) から `NEXT_PUBLIC_INDUSTRY` 環境変数を切り替えて複数業種版をビルド・デプロイ**する設計。

Salesforce 風の汎用 CRM 基盤（取引先・人物・商談・活動履歴・ToDo・経費）に、業種ごとの専用機能を重ねて提供する。

## 業種バリアント

| 業種版 | `NEXT_PUBLIC_INDUSTRY` | 主な特化機能 |
|---|---|---|
| 汎用 | `base` | 共通 CRM のみ |
| 不動産 | `real-estate` | 物件管理（土地・建物の登記、司法書士情報）、仲介手数料の自動計算（売買 3%+6 万円式 / 賃貸の月額換算）、不動産情報セクション |
| 板金・自動車整備 | `auto-body` | 車両管理（仕入・販売・整備・車検）、部品マスタ + 入出庫履歴、サービス区分別の利益計算 |

## 技術スタック

- **フレームワーク**: Next.js 16.2.6（App Router、webpack ビルド）
- **UI**: React 19.2 + Tailwind CSS 4 + Recharts
- **DB**: Neon Postgres + Drizzle ORM（業種ごとに別 Neon プロジェクト）
- **認証**: Supabase Auth（SSR cookie ベース）
- **ストレージ**: Supabase Storage（添付ファイル）
- **PWA**: `@ducanh2912/next-pwa`
- **言語**: TypeScript 5（strict）

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. `.env.local` を作成

`.env.example` をコピーして `.env.local` を作り、Neon / Supabase の credentials を埋める:

```bash
cp .env.example .env.local
```

必要キーの詳細は [`.env.example`](./.env.example) を参照。worktree ごとに `.env.local` が必要（gitignore のため）。

### 3. 開発サーバ起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認。`NEXT_PUBLIC_INDUSTRY` を変えて再起動すれば別業種版で動く。

## よく使うコマンド

```bash
npm run dev               # 開発サーバ
npm run build             # 本番ビルド (webpack)
npm run start             # 本番モード起動
npm run lint              # ESLint
npm run check:schema      # schema.ts ↔ DB のカラム整合チェック
```

`vercel-build` フックで Vercel デプロイ時に自動的に `check:schema` が走り、schema 不整合があるとビルドが失敗する仕組みになっている（AGENTS.md「DB マイグレーション運用」参照）。

## デプロイ

Vercel project は **業種ごとに別 project**（同じ `main` ブランチを監視）:

| 業種版 | Vercel project | Neon ホスト |
|---|---|---|
| real-estate | `bract-crm` (`bract-crm.vercel.app`) | `ep-soft-poetry-ao4xdfqm` |
| auto-body | `bract-crm-auto-body` | `ep-young-meadow-aoo7z9eq` |
| base | （将来追加予定） | `ep-proud-band-ao22d0oc` |

`main` への push で全業種が同時に再デプロイされる。

## 詳細リファレンス

- **[AGENTS.md](./AGENTS.md)** — 日々の作業で必読の運用ルール（ブランチ戦略、業種オーバーレイのペア確認、DB マイグレーション運用、機能追加時の検証チェックリスト、Issue 運用、worktree 慣習）
- **[docs/architecture.md](./docs/architecture.md)** — 業種オーバーレイ詳細、Vercel デプロイ構成、DB スキーマ運用、SQL pushdown 構造、既知の制限、将来検討事項

## ライセンス・状態

- リポジトリは現在 **Private**
- 1 顧客 = 1 Vercel project + 1 Neon の単一テナント構成
- 想定顧客: 不動産業 / 板金整備業ほか
