# バックアップ運用 Runbook（#24 / ADR-0027）

DB バックアップの「設定・復元・監視・拡張」をまとめた生きた手順書。
バックアップは **戻せて初めて価値**がある。月1の復元リハーサルは必須。

## 方針（ADR-0027 の要約）

- **自動化**: GitHub Actions の `schedule`（日次）。`pg_dump` バイナリを動かせる無料・既存の仕組み。
- **暗号化**: age 非対称暗号。**公開鍵だけ**を CI に置き（`AGE_RECIPIENT`）、**秘密鍵は CI に置かず手元オフライン保管**。CI が侵害されても過去 dump は復号されない。
- **保存先（段階移行）**:
  - **段階1（アーリー・現在）**: 暗号化 dump を **GitHub Actions artifact（30日保持）**。無料・非ローカル・Neon と別事業者＝オフサイト。
  - **段階2（本格リリース）**: **Cloudflare R2（Object-Lock で不変保存）** を主に、**顧客指定の Drive/Box/SharePoint へ暗号化副コピー**（3-2-1）、**Neon 有料の PITR** を一次復旧に。保存先は抽象化して差し替え。
- **不採用**: ローカルのみ保存（単一コピーはバックアップでない）／顧客 Drive を唯一の保存先（可用性が顧客環境依存）／Vercel・CF Workers の cron（pg_dump 不可）／自前 VM・MinIO（運用重・独立性低）／管理型 SaaS（費用＋第三者に DB 認証情報）。

## セットアップ（初回・1回だけ）

### 1. age 鍵ペアを手元で生成（秘密鍵は CI に絶対入れない）
```bash
# 手元の信頼できるマシンで
age-keygen -o bract-backup-key.txt
# 出力例: Public key: age1xxxxxxxx...  ← これが公開鍵（= AGE_RECIPIENT）
```
- `bract-backup-key.txt`（秘密鍵）を**二重保管**:
  1. パスワードマネージャ（1Password / Bitwarden 等）
  2. オフラインの封緘コピー（印刷 or USB を金庫等）。← PW マネージャごと失った時の最後の砦
- **この秘密鍵を失うと全 dump が復号不能（＝ただのゴミ）**になる。二重化を必ず行う。

### 2. GitHub Secrets を設定（リポジトリ Settings → Secrets）
| Secret | 必須 | 内容 |
|---|---|---|
| `AGE_RECIPIENT` | ✅ | 上の Public key（`age1...` 1行）。DB Secret があるのに未設定だと workflow は**明示的に失敗**（平文保存を防ぐため） |
| `DATABASE_URL_REAL_ESTATE` | 運用テナント分 | 各 Neon の接続文字列。未設定のテナントはスキップ |
| `DATABASE_URL_AUTO_BODY` | 同上 | |
| `DATABASE_URL_BASE` | 同上 | |
| `BACKUP_ALERT_WEBHOOK` | 任意 | 失敗時通知の Discord/Slack 互換 Webhook URL |

### 3. 手動実行で疎通確認
Actions → **DB Backup** → `Run workflow`（workflow_dispatch）→ 各テナントの artifact が生成されることを確認。

## 復元（restore）— 月1リハーサル必須

1. 対象 run の artifact（`db-backup-<target>-<run_id>`）をダウンロード → `bract-<target>-<ts>.sql.gz.age`。
2. **手元の秘密鍵**で復号して空 DB に流し込む:
   ```bash
   age -d -i bract-backup-key.txt bract-<target>-<ts>.sql.gz.age \
     | gunzip \
     | psql "<空のリストア先 DB の接続文字列>"
   ```
3. `npm run check:schema`（`.env.local` をリストア先に向ける）で整合を確認。
4. 主要ページが開くことを軽く確認。結果を #24 にコメント（日付・対象・成否）。

> ⚠ 復号には手元オフラインの秘密鍵が要る。CI/GitHub 上では復号できない（設計どおり）。

### リハーサル履歴
- **2026-06-14**: run 27491302302 の3テナント artifact を手元の秘密鍵で復号 → 有効な PG18 dump を確認（develop 57 / real-estate 51 / auto-body 41 テーブル、gzip・age 復号とも正常）。**空 DB への restore + check:schema は次回（要・空 Neon）**＝復号〜dump 健全性まで検証済み、フル restore は未。

## 監視（当日未着の検知）

- workflow 失敗時は `BACKUP_ALERT_WEBHOOK` に通知（`notify-failure` ジョブ）。
- **「そもそも走らなかった（未着）」の検知**は失敗通知では拾えない。堅牢化するなら:
  - 外部スケジューラ（cron-job.org など・無料）から GitHub の `repository_dispatch` を叩いて起動＋「当日 artifact が無ければ警告」を別途チェック。`repository_dispatch` は `schedule` の **60日自動無効化の対象外**。
- 補足: `schedule` ワークフローは**リポジトリに60日コミットが無いと自動無効化**される（最後に cron を編集した人へメール／Actions で1クリック再有効化）。本リポは活発なので実質非発火だが、上記の未着チェックを保険にする。

## テナント追加の手順
1. その顧客 Neon の接続文字列を `DATABASE_URL_<SLUG>` として Secret に追加。
2. `.github/workflows/backup.yml` の `matrix.include` に `{ target: <slug>, secret: DATABASE_URL_<SLUG> }` を追加。
3. workflow_dispatch で1回成功確認 → 復元リハを1回。
4. （段階2）顧客が増えたら repo secret から **GitHub Environments（`tenant-<slug>`）＋ matrix** にスコープを移し、テナント単位に分離する。

## 段階2（本格リリース）への移行メモ
- 保存先を artifact → **R2（S3互換・Object-Lock 有効化）** に差し替え（`aws s3 cp` で R2 エンドポイントへ）。
- 顧客が共有した Drive/Box/SharePoint フォルダへ**暗号化済みファイルの副コピー**を追加（顧客はサービスアカウントにフォルダを共有）。
- Neon を有料化し **PITR/ブランチ**を一次復旧に。dump は二次（オフサイト）として継続。
- 鍵は必要に応じて**テナント別 recipient**に分割（age は複数 recipient 可）。

## 鍵のローテーション
- 新しい recipient（公開鍵）に切替時は `AGE_RECIPIENT` を更新。**旧秘密鍵はアーカイブ保持**（旧 dump の復号に必要）。
- どの鍵で暗号化したかを世代ごとに記録（鍵バージョンをファイル名/メタに残すと安全）。
