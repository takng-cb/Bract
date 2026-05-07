# ブランチ運用ルール（GitFlow）

## ブランチ構成

| ブランチ | 役割 | 派生元 | マージ先 |
|----------|------|--------|---------|
| `main` | 本番リリース済みコード | — | — |
| `develop` | 開発統合ブランチ | `main` | — |
| `feature/*` | 機能開発 | `develop` | `develop` |
| `release/*` | リリース準備 | `develop` | `main` + `develop` |
| `hotfix/*` | 本番緊急修正 | `main` | `main` + `develop` |

---

## 通常の開発フロー（feature）

```bash
# 1. develop から feature ブランチを作成
git checkout develop
git pull origin develop
git checkout -b feature/機能名

# 2. 開発・コミット
git add ...
git commit -m "feat: ..."

# 3. develop へマージ（PR 経由 or 直接）
git checkout develop
git merge --no-ff feature/機能名
git push origin develop

# 4. feature ブランチを削除
git branch -d feature/機能名
```

---

## リリースフロー（release）

```bash
# 1. develop から release ブランチを作成
git checkout develop
git checkout -b release/v1.2.0

# 2. バージョン番号・CHANGELOG 更新など仕上げ作業
git commit -m "chore: bump version to 1.2.0"

# 3. main にマージ & タグ付け
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --tags

# 4. develop にもマージ（差分を取り込む）
git checkout develop
git merge --no-ff release/v1.2.0
git push origin develop

# 5. release ブランチを削除
git branch -d release/v1.2.0
```

---

## 緊急修正フロー（hotfix）

```bash
# 1. main から hotfix ブランチを作成
git checkout main
git checkout -b hotfix/バグ内容

# 2. 修正・コミット
git commit -m "fix: ..."

# 3. main にマージ & タグ付け
git checkout main
git merge --no-ff hotfix/バグ内容
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin main --tags

# 4. develop にもマージ
git checkout develop
git merge --no-ff hotfix/バグ内容
git push origin develop

# 5. hotfix ブランチを削除
git branch -d hotfix/バグ内容
```

---

## コミットメッセージ規約（Conventional Commits）

```
<type>: <概要（日本語可）>

types:
  feat     - 新機能
  fix      - バグ修正
  docs     - ドキュメントのみの変更
  style    - コード意味に影響しない変更（フォーマット等）
  refactor - バグ修正でも機能追加でもないリファクタリング
  test     - テストの追加・修正
  chore    - ビルド・補助ツールの変更
```

---

## Claude が作業する際のルール

1. **必ず `develop` を起点に `feature/*` ブランチを作成**して作業する
2. 作業完了後は `feature/*` → `develop` へ `--no-ff` マージ
3. **`main` への直接コミット・push は禁止**（hotfix 以外）
4. `main` へのマージは必ず `release/*` または `hotfix/*` 経由
