# #21 「オブジェクト」→「ブック」リネーム — 段階移行プラン

> **方針：ビッグバン禁止。** 破壊的（DB列・ルート・コード多数・next.config redirect が連動）のため、
> **ユーザー可視ラベル → コード識別子 → ルート → DB の順**で、各段が独立して動作確認・ロールバック可能な
> 段階に割る。実行は監督下セッションで行う（本番は本番デプロイでしか確認できないため）。

語彙（ADR-0018）：**モジュール > ブック(Book) > レコード**。`object_definitions` 等の「オブジェクト」概念を「ブック」に統一する。

---

## 影響範囲（grep の目安）
- DB: `object_definitions`, `field_definitions`（`object_id`）, `custom_records`（`object_id`）, `object_api_name` 等のカラム/参照。
- ルート: `/admin/objects`, `/objects/<apiName>`（一覧/詳細/new/edit）, `/admin/objects/[id]`。
- コード: `getObjectDef`, `getAllObjectDefs`, `ObjectDef`, `objectMetadata.ts`, `customObjectsToNavItems`, `MODULE_REGISTRY.books`（既に book 語彙）など多数。
- next.config: 業種 redirect には直接は無いが、`/objects/*` のルート規約に依存する箇所に注意。

---

## 段階

### Stage 0 — 確定（監督下・所要小）
- リネームの**範囲を確定**：①UIラベルのみ／②＋コード識別子／③＋ルート(URL)／④＋DB列。
- **推奨**：①→②→③→④の順で、まず①を即実施、②以降は段階。④（DB）は最後で最重量。

### Stage 1 — ユーザー可視ラベルのみ（非破壊・即可・ロールバック容易）
- 画面の文言「オブジェクト」→「ブック」に統一（`/admin/objects` 見出し、説明文、ボタン「新規オブジェクト」→「新規ブック」等）。
- **コード識別子・ルート・DB は触らない**。挙動完全不変。
- 検証：3業種ビルド＋目視。これは通常 PR で安全に出せる。
- （補足：モジュール registry・クイック操作は既に「ブック」語彙を使用済み。残りは admin/objects 系の文言。）

### Stage 2 — コード識別子のリネーム（中・型で守れる）
- `ObjectDef`→`BookDef`, `getObjectDef`→`getBook`, `objectMetadata.ts`→`bookMetadata.ts` 等を**型・関数名のみ**機械的にリネーム（API/DB/ルートは不変）。
- 互換 re-export を一時的に残し、段階的に呼び出し側を移行。
- 検証：tsc/ build green、ユニット/E2E green。挙動不変。

### Stage 3 — ルート(URL)のリネーム（中・redirect 必須）
- `/objects/<api>` → `/books/<api>`、`/admin/objects` → `/admin/books`。
- **旧URLから新URLへ 301/308 redirect** を next.config or middleware に追加（ブックマーク・外部リンク保護）。
- `recordHref()` / nav href 生成 / `customObjectsToNavItems` を新ルートに更新。
- 検証：smoke（旧URL→新URL redirect）、E2E、3業種ビルド。

### Stage 4 — DB 列/テーブルのリネーム（重・最後・要バックアップ）
- `object_definitions`→`book_definitions`, `field_definitions.object_id`→`book_id`, `custom_records.object_id`→`book_id` など。
- **冪等マイグレ＋互換ビュー**：まず新名称を `ADD`／`VIEW` で並走させ、コードを新名称に切替えてから旧を撤去（2段階）。全 Neon に適用（AGENTS.md）。
- `scripts/check-schema-vs-db.ts` を新スキーマで pass させる。snapshot バックアップ必須。
- 検証：check:schema 全 Neon green、本番デプロイ後の主要ページ実機確認。

---

## ロールバック
- Stage 1/2：revert PR で即戻し。
- Stage 3：redirect を残せば旧URLは生存。コードを戻せば復帰。
- Stage 4：互換ビュー/2段階マイグレにより、撤去前なら旧名称へ復帰可能。撤去後はバックアップから restore。

## 受け入れ基準（各段共通）
- `npm run build` 3業種 green / 単体・E2E green / `npm run check:schema` 全 Neon green。
- 本番デプロイ後に `/admin/(objects|books)` と代表ブックの一覧・詳細を実機確認。

## 関連
- REQ-0010 / ADR-0017（リネーム方針）/ ADR-0018（モジュール>ブック）/ #21 / docs/module-registry-implementation-plan.md
