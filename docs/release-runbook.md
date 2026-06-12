# リリース運用 Runbook — 顧客別リリースブランチ方式（ADR-0024 / #130）

> 複数顧客（1社=1コンテナ=1 Vercel project + 1 Neon + 1 Supabase）への継続リリースの標準手順。
> 関連: [`docs/deployment-runbook.md`](./deployment-runbook.md)（コンテナ新設）, [`docs/requirements/decisions.md`](./requirements/decisions.md) ADR-0024, Issue #130。

---

## 1. ブランチ構成

| ブランチ | 役割 | 追従する Vercel project |
|---|---|---|
| `main` | 開発・即時反映（カナリア） | 自社デモ/開発コンテナ（dev） |
| `release-ProjectID` | 顧客 ProjectID 向け安定ブランチ | bract-projectid（仮称） |
| `release-Cactus` | 顧客 Cactus 向け安定ブランチ | bract-cactus（仮称） |
| `release-Yamamoto` | 顧客 Yamamoto 向け安定ブランチ | bract-yamamoto（仮称） |

**大原則: release ブランチに main に無いコミットを作らない。**
release ブランチは「検証済みの main の特定時点を指すポインタ」であり、**コードは全顧客共通**。
顧客ごとの差（業種・有効機能）はブランチではなく**ランタイム設定**（env ＋ licenses）で表現する（§3）。

```
main ──A──B──C──D──E──F──→（開発はここだけ）
            │        │
            │        └─ release-Cactus（= E まで反映）
            └─ release-ProjectID / release-Yamamoto（= C で据え置き中）
```

## 2. 通常リリースの手順（release train）

1. **検証ゲート**（main 上で全部緑にする）
   - CI green（lint / test / 3業種 build / schema-check / smoke）
   - dev コンテナ（main 追従）で対象機能の実機スモーク
   - 新規マイグレーションがある場合: **全顧客 Neon に適用済み**であること（§4）
2. **release ブランチを進める**（fast-forward のみ）
   ```bash
   git fetch origin
   git switch release-<Customer>
   git merge --ff-only origin/main     # ff できない状態は異常（release に直接コミットした事故）
   git push origin release-<Customer>
   ```
3. **タグ**（全顧客一斉の節目のみで可）: `package.json` の `version` を同じ値に更新してから `git tag vX.Y.Z && git push --tags`。
   アプリのサイドバー（ユーザーメニュー下）と /about に `vX.Y.Z (SHA)` が表示されるので、顧客がどの版かはここで特定できる（#130）
4. Vercel の deploy 緑を確認 → 顧客コンテナの主要ページを Chrome で目視（AGENTS.md の検証チェックリスト）

- 顧客ごとに進めるタイミングを変えてよい（順次展開）。据え置きたい顧客は単に release ブランチを進めない。
- 全顧客同時リリースは 3 ブランチを同じ commit に進めるだけ。

## 3. 顧客設定マトリクス（コードは共通、差はここだけ）

| 顧客 | NEXT_PUBLIC_INDUSTRY | BRACT_BUILD_PROFILE | licenses.features.enabled_modules（= entitled_modules） |
|---|---|---|---|
| ProjectID（板金のみ） | `auto-body` | `all`（既定） | `["auto-body"]` ＋常時有効群 |
| Cactus（ERP＋不動産） | `real-estate` | `all`（既定） | `["inventory", "real-estate"]` ＋常時有効群 |
| Yamamoto（人材手配） | `staffing` | `all`（既定） | `["staffing"]` ＋常時有効群 |

- **常時有効群**（`ALWAYS_ON`: crm-core / workspace / sales / expenses）は enabled_modules に書かなくても有効。
- enabled_modules は各顧客 Neon の `licenses` 行（`features` JSON）に設定。`/admin/modules` でも切替可（運営者）。
- enabled_modules 未設定時は `NEXT_PUBLIC_INDUSTRY` から導出する互換シムが効くため、**最低限 env の設定だけでも正しい業種で動く**。
- そのほかの env（DATABASE_URL / SUPABASE_* / GEMINI_API_KEY / PROVIDER_EMAILS 等）は [`docs/deployment-runbook.md`](./deployment-runbook.md) の一覧に従う。

## 4. DB マイグレーションの順序（最重要）

既存ルール「**全 Neon に全マイグレ**」（AGENTS.md）を維持した上で、順序を固定する:

```
1. マイグレ SQL を main にマージ（冪等必須・IF NOT EXISTS / DO $ 禁止）
2. 全顧客 Neon に適用（据え置き中の顧客の Neon も含む）→ check:schema 緑
3. その後で release ブランチを進める
```

- 適用が先・コードが後。後方互換マイグレ（ADD COLUMN IF NOT EXISTS / DEFAULT付き）なら据え置き顧客の旧コードも壊れない。
- `vercel-build` の check:schema が「未適用 Neon へのデプロイ」を exit 1 でブロックする（最後の防壁）。

## 5. hotfix の手順

1. `fix/<name>` を main から切る → 修正 → main にマージ（通常フロー）
2. 影響顧客の release ブランチへ反映:
   - release が main の直近に居る場合: §2 の ff で進めるだけ
   - release を古い時点に据え置いたまま修正だけ入れたい場合（例外運用）:
     ```bash
     git switch release-<Customer>
     git cherry-pick <fix-commit>        # main に無いコミットが生まれるため、
     git push origin release-<Customer>  # 次回の通常リリース時は --ff-only ではなく
                                          # main の同内容を含む時点まで進めて解消する
     ```
3. 重大バグ（データ破損・全停止・セキュリティ）は**即日**全顧客 release へ反映する

## 6. 据え置き・ロールバック

- **据え置き**: 何もしない（release ブランチを進めない）だけ。
- **ロールバック**: release ブランチを前のタグ/commit に戻す
  ```bash
  git switch release-<Customer>
  git reset --hard <前の commit / タグ>
  git push --force-with-lease origin release-<Customer>   # release は他人が積まない前提の管理ブランチ
  ```
  Vercel が自動で再デプロイする。DB は前進のみ（マイグレは後方互換のためロールバック不要）。

## 7. 顧客コンテナ新設チェックリスト（provisioning）

[`docs/deployment-runbook.md`](./deployment-runbook.md) の詳細手順に従い、順番だけここに固定する:

1. Neon project 作成 → **既存マイグレを全部適用** → `npm run check:schema` 緑
2. Supabase project 作成（招待制設定・REQ-0033）
3. Vercel project 作成 → **Production Branch を `release-<Customer>` に設定** → env 一式投入
4. `create-admin-user` で初期管理者＋運営用アカウント作成、`PROVIDER_EMAILS` に運営者メール設定（REQ-0046）
5. licenses 行を投入（plan / entitled_modules / enabled_modules、§3 のマトリクス）
6. GitHub Secrets にバックアップ用 DATABASE_URL を登録（#24 日次 dump 対象に追加）
7. Vercel deploy 失敗 webhook を設定（#25）
8. AGENTS.md「接続先 Neon 一覧」とこの Runbook の §1/§3 に行を追加

## 8. セキュリティ分離チェック（顧客追加時に毎回確認）

- [ ] DATABASE_URL が顧客専用 Neon を指す（他顧客と共有していない）
- [ ] SUPABASE_URL / KEY が顧客専用 project（auth ユーザーが他顧客と混ざらない）
- [ ] Vercel env に他顧客の値の残骸が無い（コピー作成時に特に注意）
- [ ] PROVIDER_EMAILS は運営者のみ（顧客管理者を入れない）
- [ ] GitHub Secrets のバックアップ URL が顧客別に分かれている
- 共有してよいもの: コード（リポジトリ）と GEMINI_API_KEY（必要ならコスト按分のため顧客別キーに分割可）
