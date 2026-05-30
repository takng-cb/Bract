# リリースに向けてユーザー対応が必要なタスク

> **目的**: 板金 (auto-body) を中心に Bract CRM を商用リリースするために、コードでは完結せず **ユーザー（経営判断・契約・外部設定）の対応が必要な作業** を一覧化。
> **想定**: 明日以降、優先順位の高い順に対応。Claude（私）は各タスクの実装側を引き続き並行で進める。
> **最終更新**: 2026-05-27（main: af5943d）

---

## 🚨 Phase 0: リリース直前に必須（優先度: 最高）

### ☐ 0-1. Slack / Discord Webhook の発行

- **目的**: Vercel deploy 失敗・本番アラートをリアルタイム把握するため。これがないと障害発生に気づけない。
- **関連 Issue**: [#25](https://github.com/takng-cb/Bract-CRM/issues/25)
- **手順**:
  1. Slack の場合: 通知用ワークスペースで Incoming Webhook を発行（https://api.slack.com/messaging/webhooks）
  2. Discord の場合: サーバー設定 → 連携サービス → ウェブフック → 新規ウェブフック
  3. 発行された URL を私に共有 → 私が Vercel env / GitHub Actions に組み込み
- **私の対応**: webhook 通知コードを Vercel deployment hook + GitHub Actions に組み込む
- **目安**: 10 分

### ☐ 0-2. 法務文書（利用規約・プライバシーポリシー）の確定

- **目的**: 商用サービス提供の法的根拠。これがないと契約が結べない / 個人情報を扱えない。
- **関連 Issue**: 過去ドラフト ([7659a31](https://github.com/takng-cb/Bract-CRM/commit/7659a31)) で 7 種作成済み
- **手順**:
  1. 既存ドラフトを `docs/legal-drafts/` で確認
  2. 弁護士（中小企業向け IT 法務に強い人）に相談
     - 推奨: 経済産業省「中小企業向け契約書ひな型」をベースに弁護士監修
     - 費用目安: 着手金 ¥100,000-300,000 + 顧問契約 ¥30,000-50,000/月
  3. 確定版を `docs/legal/` 配下に配置 + Web 公開ページ作成
  4. 顧客契約時に必須署名
- **私の対応**: 確定後、`/about/legal` 配下に公開ページを実装可能
- **目安**: 1〜2 週間（弁護士相談含む）

### ☐ 0-3. Vercel 環境変数の本番設定確認

- **目的**: AI 機能・LINE 連携などの feature flag が正しく設定されているか確認
- **関連 Issue**: [#67](https://github.com/takng-cb/Bract-CRM/issues/67)
- **手順**:
  1. Vercel プロジェクト → Settings → Environment Variables を開く
  2. 以下を確認・設定:
     - `DATABASE_URL` (auto-body Neon)
     - `NEXT_PUBLIC_INDUSTRY=auto-body`
     - `NEXT_PUBLIC_APP_URL` (本番 URL)
     - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
     - `AI_FEATURE_ENABLED` ← 板金顧客が AI 利用契約していれば `true`、未契約なら未設定
     - `LINE_FEATURE_ENABLED` ← 未実装なので未設定
  3. Production / Preview / Development の scope を適切に
- **私の対応**: AI / LINE 機能が必要になった時点で実装をオン
- **目安**: 30 分

### ☐ 0-4. 板金顧客のオンボーディング（最初の顧客の初期設定）

- **目的**: 「最初の数社」に渡せる状態にする。導入支援含めて顧客が使えるようになるまで伴走。
- **関連 Issue**: [#22](https://github.com/takng-cb/Bract-CRM/issues/22)
- **手順**:
  1. 顧客から既存データ（取引先・顧客車両・整備履歴等）の CSV / Excel を受領
  2. データの clean up（フォーマット整形、重複除去）
  3. CSV インポート機能で投入
  4. ユーザーアカウント発行（admin 1 名 + editor / viewer 必要分）
  5. 業種オーバーレイ機能（整備パッケージ、損傷マップ、帳票テンプレ）の確認
  6. オンライン研修（2 時間程度）
  7. 1 週間のフォロー（チャット/メール対応）
- **私の対応**: 必要なテンプレ・帳票調整、UI 修正
- **目安**: 顧客 1 社あたり 2〜5 日

### ☐ 0-5. Stripe アカウント開設 & インボイス制度対応

- **目的**: 顧客から月額・初期費用を徴収できる体制を作る
- **関連 Issue**: [#16](https://github.com/takng-cb/Bract-CRM/issues/16)
- **手順**:
  1. Stripe アカウント開設（https://dashboard.stripe.com/register）
  2. KYC（本人確認）完了
  3. 適格請求書発行事業者の登録（インボイス制度対応）
  4. 価格表 (`docs/pricing.md`) の各プランを Stripe Product として登録
     - Starter Base (¥8,000/月 月額固定)
     - Starter Per-User (¥3,500/user/月)
     - AI ライセンス (¥5,000/月)
     - 初期費用 (one-time ¥100,000-150,000)
  5. Stripe Secret Key / Webhook Secret / Publishable Key を Vercel env に追加
  6. 私が Stripe SDK を導入 → Checkout / Customer Portal / Webhook 実装
- **私の対応**: 上記 6 のコード実装
- **目安**: アカウント開設 1 週間 + 私の実装 1 週間

---

## 🔥 Phase 1: リリース後 1〜3 ヶ月（優先度: 高）

### ☐ 1-1. Supabase Storage バケットの作成（写真機能用）

- **目的**: 整備の損傷写真・進捗写真を保存する場所を確保 ([#46](https://github.com/takng-cb/Bract-CRM/issues/46))
- **手順**:
  1. Supabase Dashboard → Storage → New Bucket
  2. バケット名: `maintenance-photos`
  3. Public/Private: **Private**（認証必須）
  4. RLS ポリシー設定:
     - 読み取り: 認証済み + 当該整備にアクセス権ある user のみ
     - 書き込み: editor 以上
  5. CORS 設定（必要に応じて）
  6. 完了後私に共有 → 私が機能実装
- **私の対応**: アップロード UI、画像最適化、lightbox 表示、整備詳細への組み込み
- **目安**: ユーザー作業 1 時間 + 私の実装 2〜3 日

### ☐ 1-2. プライバシーマーク取得の準備開始

- **目的**: 中堅企業案件を獲得可能にする ([#58](https://github.com/takng-cb/Bract-CRM/issues/58))
- **手順**:
  1. JIPDEC のサイトで申請ガイドを取得
  2. コンサルタントの相見積（推奨: 3 社、費用 ¥300,000-500,000）
  3. 社内体制整備（個人情報保護管理者・監査責任者の任命）
  4. 規程類の整備（管理規程、教育規程、苦情対応規程）
  5. 委託先管理（Vercel / Supabase / Neon の SOC 2 証跡保管）
  6. 内部監査の実施
  7. JIPDEC へ申請 → 現地審査対応
- **私の対応**: 委託先管理リスト・データフロー図のドキュメント作成支援
- **目安**: 3〜6 ヶ月

### ☐ 1-3. データバックアップの本番運用判断

- **目的**: 顧客データ消失のリスクを最小化 ([#24](https://github.com/takng-cb/Bract-CRM/issues/24))
- **手順**:
  1. Neon の現在のプランを確認（Free vs Launch vs Scale）
  2. PITR (Point-In-Time Recovery) の保持期間を決定
     - Free: 24 時間
     - Launch ($19/月): 7 日間
     - Scale ($69/月〜): 14〜30 日間
  3. 顧客契約に応じてプランをアップグレード（推奨: 最低 Launch 以上）
  4. 別リージョン or 別サービスへの夜間 dump 退避要否判断
  5. 私に方針共有 → 自動化スクリプト整備
- **私の対応**: dump 自動化 (GitHub Actions cron) + リストア手順書
- **目安**: 判断 1 日 + 私の実装 半日

### ☐ 1-4. ユーザー指名の早期顧客（アーリーアダプター）獲得

- **目的**: アーリーアダプター価格 (docs/pricing.md) で 10 社獲得し、実績作り
- **手順**:
  1. ターゲット業界・地域の決定（推奨: 関東圏の小規模整備工場 5-10 名規模）
  2. 営業リスト作成（既存顧客の知人、業界団体経由、SNS 等）
  3. 提案資料（docs/pricing.md ベース）作成
  4. デモ環境準備（テストデータ整備済み）
  5. 商談 → 契約 → 導入支援
- **私の対応**: デモ用テストデータ整備、デモ用 Vercel deploy、提案資料の Markdown 化
- **目安**: 営業活動継続中（3〜6 ヶ月で 10 社目標）

---

## 🟡 Phase 2: 顧客拡大期（3〜6 ヶ月、優先度: 中）

### ☐ 2-1. UptimeRobot / Statuspage の契約

- **目的**: 稼働率監視と顧客向けステータスページ ([#64](https://github.com/takng-cb/Bract-CRM/issues/64))
- **手順**:
  1. UptimeRobot 無料プラン登録（10 モニター無料）or Better Uptime
  2. 監視対象: `https://app.bract-crm.com/api/health` 等
  3. 通知先設定: Slack webhook（0-1 で発行済み）
  4. Statuspage 検討（任意、月 $29〜）
  5. 私に共有 → SLA ドキュメント整備
- **私の対応**: `/api/health` エンドポイント実装、SLA 利用規約ドラフト
- **目安**: 1〜2 時間

### ☐ 2-2. LINE Developer Console セットアップ（LINE 連携時）

- **目的**: LINE 連携機能を顧客に提供 ([#68](https://github.com/takng-cb/Bract-CRM/issues/68))
- **手順**:
  1. LINE Developers Console（https://developers.line.biz/console/）にログイン
  2. プロバイダー作成（Bract 名）
  3. **LINE 公式アカウント** 作成
  4. Messaging API チャネルを発行
  5. Channel ID / Channel Secret / Channel Access Token を取得
  6. Webhook URL を Bract に設定: `https://app.bract-crm.com/api/webhooks/line`
  7. Webhook の verification ON
  8. 私に Channel credentials 共有 → admin 画面で設定 or env に登録
- **私の対応**: LINE 連携機能の実装（受信→活動化、送信、テンプレ）
- **目安**: ユーザー作業 1 時間 + 私の実装 1〜2 週間

### ☐ 2-3. AI プロバイダ（Groq / Gemini / Anthropic）の API キー発行

- **目的**: AI まとめ機能を顧客に提供
- **手順**:
  1. プロバイダ選定（推奨: Groq は低コスト、Gemini は無料枠あり、Anthropic は精度高）
  2. 各プロバイダのアカウント作成・API キー発行
  3. 利用量モニタリング設定（コスト爆発防止）
  4. Bract の `/admin/ai` 設定画面で API キー登録
- **私の対応**: 実装完了済み。設定 UI も実装済み
- **目安**: プロバイダごとに 30 分

---

## 🟢 Phase 3: 中長期（6 ヶ月〜、優先度: 必要に応じて）

### ☐ 3-1. ISMS / SOC 2 取得（大企業案件参入時）

- **目的**: 大企業・官公庁案件の参入 ([#59](https://github.com/takng-cb/Bract-CRM/issues/59))
- **手順**: プライバシーマーク取得後に着手
- **目安**: 8〜12 ヶ月

### ☐ 3-2. 第三者ペネトレーションテスト

- **目的**: セキュリティ脆弱性の客観評価 ([#63](https://github.com/takng-cb/Bract-CRM/issues/63))
- **手順**:
  1. ベンダー相見積（GMO サイバーセキュリティ / Flatt Security 等）
  2. 範囲合意（Web / API / インフラ）
  3. 実施・修正対応
  4. 報告書を営業資料に活用
- **目安**: 1〜3 ヶ月、費用 ¥500,000-2,000,000

### ☐ 3-3. データ国内保管要件への対応（必要顧客が出た時）

- **目的**: 医療・自治体顧客の参入 ([#62](https://github.com/takng-cb/Bract-CRM/issues/62))
- **手順**: Neon 東京リージョン提供を待つ or AWS RDS Tokyo / Supabase 統合
- **目安**: 移行作業 1〜2 週間

---

## 📋 私（Claude）が並行で進めている / 進められる作業

ユーザー対応待ちの間、私は以下を autonomous で進められます:

| 項目 | 関連 Issue | 状態 |
|---|---|---|
| #47 部品在庫 本格対応（schema 含む実装）| [#47](https://github.com/takng-cb/Bract-CRM/issues/47) | 着手可 |
| #48 売掛金 本格対応（schema 含む実装）| [#48](https://github.com/takng-cb/Bract-CRM/issues/48) | 着手可 |
| #1 不動産 媒介契約報告書生成 | [#1](https://github.com/takng-cb/Bract-CRM/issues/1) | 着手可 |
| #17 Neon compute hour 監視 | [#17](https://github.com/takng-cb/Bract-CRM/issues/17) | 着手可 |
| #27 モバイル UX 検証 | [#27](https://github.com/takng-cb/Bract-CRM/issues/27) | 着手可 |
| ライセンス制御 Phase 2 (admin UI) | [#67](https://github.com/takng-cb/Bract-CRM/issues/67) | 着手可 |
| LINE 連携 Phase 1（コード）| [#68](https://github.com/takng-cb/Bract-CRM/issues/68) | LINE Console 設定待ち |
| staffing 業種オーバーレイ | [#69](https://github.com/takng-cb/Bract-CRM/issues/69) | 着手可 |
| auto-body Tier 2 機能 (#49-#52) | 各 Issue | 着手可 |

「次は #47 部品本格対応から進めて」「Stripe アカウント開設したから連携実装して」など指示があれば対応します。

---

## チェックリスト管理

このドキュメントの `☐` を `☑` に変えていく形で進捗を追えます。
完了したタスクの commit hash や日付を記載すると後追いしやすいです。

---

## 関連ドキュメント

- [docs/pricing.md](./pricing.md) — 価格表
- [README.md](../README.md)
- AGENTS.md
- [Issue #66 エンタープライズ対応 umbrella](https://github.com/takng-cb/Bract-CRM/issues/66)
- [Issue #67 ライセンス制御](https://github.com/takng-cb/Bract-CRM/issues/67)
