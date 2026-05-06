# テスト結果: 初回総合テスト

**実施日**: 2026-05-06  
**実施者**: Claude Sonnet 4.6（コードレビュー + ユーザー報告ベース）  
**環境**: https://bract-crm.vercel.app / Android Chrome

---

## 認証（TC-AUTH）

| ID | テスト名 | 結果 | 備考 |
|----|---------|------|------|
| TC-AUTH-001 | メールログイン（正常） | ✅ PASS | |
| TC-AUTH-002 | メールログイン（パスワード誤り） | ✅ PASS | エラーメッセージ表示確認済み |
| TC-AUTH-003 | Google OAuth ログイン | ✅ PASS | |
| TC-AUTH-004 | 未ログイン時のアクセス制御 | ✅ PASS | proxy.ts ミドルウェアで保護 |
| TC-AUTH-005 | パスワードリセット画面へのアクセス | ❌→✅ FIXED | proxy.ts が /forgot-password を遮断していた → 修正済み |
| TC-AUTH-006 | パスワードリセットメール送信 | ⚠️ PARTIAL | カスタムSMTP未設定時はレート制限あり（1h/3通）。Supabaseデフォルトでは到達率低 |
| TC-AUTH-007 | パスワード更新 | ⏭️ SKIP | メール未受信のため未確認 |
| TC-AUTH-008 | ログアウト | ✅ PASS | |

---

## リストビュー（TC-LIST）

| ID | テスト名 | 結果 | 備考 |
|----|---------|------|------|
| TC-LIST-001 | PC テーブル表示 | ✅ PASS | 全7オブジェクト確認 |
| TC-LIST-002 | モバイル カード表示 | ❌→✅ FIXED | useSearchParams を GroupedTable で使用していたため Next.js 16 でクラッシュ → window.location.search + props に変更 |
| TC-LIST-003 | 空状態の表示 | ✅ PASS | |
| TC-LIST-004 | ページネーション | ✅ PASS | |
| TC-LIST-005 | フィルター機能 | ✅ PASS | |
| TC-LIST-006 | フィルタークリア | ✅ PASS | |
| TC-LIST-007 | CSV エクスポート | ✅ PASS | |
| TC-LIST-008 | CSV インポート | ✅ PASS | 編集権限ユーザーのみ表示 |
| TC-LIST-009 | 列表示設定 | ✅ PASS | |

---

## ソート・グルーピング（TC-SORT / TC-GROUP）

| ID | テスト名 | 結果 | 備考 |
|----|---------|------|------|
| TC-SORT-001 | 列ヘッダークリックで昇順ソート | ✅ PASS | ▲ アイコン表示 |
| TC-SORT-002 | 同列再クリックで降順 | ✅ PASS | ▼ アイコン表示 |
| TC-SORT-003 | 降順から解除 | ✅ PASS | ↕ アイコンに戻る |
| TC-SORT-004 | 複数列ソート（最大3列） | ✅ PASS | 番号バッジ表示 |
| TC-SORT-005 | 4列目クリック時の最古置き換え | ✅ PASS | |
| TC-SORT-006 | ソート時のページリセット | ✅ PASS | |
| TC-GROUP-001 | グルーピング適用 | ✅ PASS | |
| TC-GROUP-002 | ネストグルーピング | ✅ PASS | |
| TC-GROUP-003 | グルーピング中のモバイル表示 | ✅ PASS | カード非表示は仕様通り |
| TC-COL-001 | 列幅リサイズ | ✅ PASS | ドラッグで変更。セッション限定 |

---

## ビュー保存（TC-VIEW）

| ID | テスト名 | 結果 | 備考 |
|----|---------|------|------|
| TC-VIEW-001 | 個人ビューの保存 | ✅ PASS | |
| TC-VIEW-002 | 保存ビューの呼び出し | ✅ PASS | |
| TC-VIEW-003 | 個人デフォルトビューの設定 | ✅ PASS | |
| TC-VIEW-004 | デフォルトビューの解除 | ✅ PASS | |
| TC-VIEW-005 | 個人ビューの削除 | ✅ PASS | |
| TC-VIEW-006 | システムビューの保存（管理者） | ✅ PASS | |
| TC-VIEW-007 | システムビュー保存権限（一般ユーザー） | ✅ PASS | スコープ選択非表示確認 |
| TC-VIEW-008 | ソート条件の保存 | ✅ PASS | sort_params カラム追加済み |

---

## PWA・モバイル（TC-PWA / TC-MOB）

| ID | テスト名 | 結果 | 備考 |
|----|---------|------|------|
| TC-PWA-001 | Android Chrome インストールプロンプト | ❌ FAIL | 「ショートカットを作成」が表示される。manifest.json を追加・改善済みだが未解決。Chrome のエンゲージメント要件待ちの可能性あり |
| TC-PWA-002 | PWA としての起動 | ⏭️ SKIP | TC-PWA-001 未解決のため |
| TC-PWA-003 | Web App Manifest の確認 | ✅ PASS | manifest.json 配置済み（id, display:standalone, icons 192/512 含む） |
| TC-PWA-004 | Service Worker の登録確認 | ✅ PASS | @ducanh2912/next-pwa で sw.js 生成済み |
| TC-MOB-001 | モバイル レイアウト（取引先） | ❌→✅ FIXED | TC-LIST-002 と同根原因。修正済み |
| TC-MOB-002 | モバイル レイアウト（全オブジェクト） | ❌→✅ FIXED | 全7オブジェクト同様に修正 |
| TC-MOB-003 | モバイル ナビゲーション | ✅ PASS | |
| TC-MOB-004 | モバイル 詳細ページ遷移 | ✅ PASS | レコード名リンクで遷移 |

---

## 未解決の既知問題

| # | 問題 | 対応状況 |
|---|------|---------|
| 1 | Android Chrome で「インストール」プロンプトが出ない | manifest.json 改善済み。Chrome エンゲージメント待ち or 追加調査必要 |
| 2 | パスワードリセットメール未到達 | カスタムSMTP（Resend等）設定を推奨 |
