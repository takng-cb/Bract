# 決定記録（ADR — Architecture Decision Records）

**追記専用。** 既存エントリは書き換えない。決定を覆す場合は新しい ADR を追加し、旧 ADR の状態を `Superseded by ADR-xxxx` にする（理由が残るように）。

各エントリの書式：
```
### ADR-NNNN  〈決定の短いタイトル〉
- 日付 / 状態（採用|保留|却下|Superseded by ADR-xxxx）
- 文脈：なぜ判断が必要だったか
- 決定：何を決めたか
- 理由：なぜそれを選んだか
- 影響：関連 REQ / 変わる範囲
- 代替案：採らなかった選択肢（再考の条件）
```

---

### ADR-0001  Bract を CRM 専用から CRM/ERP モジュラー基盤へ発展
- 2026-06-07 / **採用**
- 文脈：CRM だけでなく ERP にも対応し、顧客ごとに機能を組み合わせたい。現状は業種オーバーレイ（ビルド時固定）で 1社1業種に縛られる。
- 決定：「業種（industry）」を上位概念「モジュール（module）」へ昇格。業種も `category:'industry'` のモジュールとして扱う。
- 理由：ERP の横断機能（在庫・会計等）を表現でき、組み合わせ提供が可能になる。
- 影響：REQ-0001。`src/modules/` 構造、`docs/erp-architecture.md`。
- 代替案：業種オーバーレイのまま拡張 → 組み合わせ不可のため却下。

### ADR-0002  合成方式はランタイム合成 ＋ ビルドプロファイル（ハイブリッド）
- 2026-06-07 / **採用**
- 文脈：機能 ON/OFF を再ビルドなしで変えたい一方、複数社展開時のビルドの軽さも要る。
- 決定：同梱モジュール「群」は `BRACT_BUILD_PROFILE` でビルド時に粗く選択。範囲内の個別 ON/OFF は `licenses.features.enabled_modules` でランタイム（再ビルド不要）。
- 理由：軽さ（出荷時に重い ERP/業種を除外可）と柔軟性（日々のトグル）の両立。
- 影響：REQ-0002, REQ-0003。`next.config.ts`, `src/lib/modules/registry.ts`。
- 代替案：純ランタイム（全同梱）＝シンプルだが未使用 ERP も同梱／純ビルド時＝柔軟性低。

### ADR-0003  テナントは単一テナント維持（1社=1デプロイ+1DB）
- 2026-06-07 / **採用**
- 文脈：複数社展開の「重さ」を懸念。マルチテナント化も選択肢に上がった。
- 決定：1社=1 Vercel project + 1 Neon DB の物理分離を維持。重さはプロビジョニング自動化とビルドプロファイルで対処。
- 理由：データ分離が最も堅い。既存資産をそのまま活かせる。人材手配ブリーフの「単一企業向け」とも一致。
- 影響：REQ-0003。将来マルチテナント化の余地は `licenses.tenant_key` で残す。
- 代替案：共有アプリ+社ごとDB／完全マルチテナント(RLS) → 現時点では不採用。

### ADR-0004  AI はコントラクトファーストの入力補助（draft-then-apply）
- 2026-06-07 / **採用**
- 文脈：「LLM 起点で行動」したいが、まずは入力補助として安全に使いたい。
- 決定：各モジュールが型付き入力コントラクトを持ち、LLM はスキーマ準拠データを生成 → 人が確認 → 既存 apply 層が検証して DB 反映。**LLM は DB を直接触らない**。
- 理由：human-in-the-loop で安全。既存 CSV インポート経路を再利用できる。将来の MCP/自律(L2/L3)へ無改修で延ばせる。
- 影響：REQ-0004。`docs/ai-input-assistant.md`、各 `modules/<id>/contracts.ts`。
- 代替案：フルのツール実行型エージェント → 現時点ではリスク過大で見送り。

### ADR-0005  モジュール ON/OFF のセキュリティ＝上限と表示の分離＋サーバー側ゲート
- 2026-06-07 / **採用**
- 文脈：ランタイム ON/OFF が不正に有効化されない設計が必要。
- 決定：`entitled_modules`（契約上限・提供側のみ設定）と `enabled_modules`（上限内で表示）を分離。判定は必ずサーバー側（`ensureModuleEnabled`/`requireAdmin`）。入力はホワイトリスト＋上限検証。
- 理由：外部からの不正 ON を防ぎ、テナント管理者の未契約自己有効化も防ぐ。client 改竄は無効。
- 影響：REQ-0002。`docs/erp-architecture.md` §8。
- 代替案：単一 `modules` 配列のみ → 自己有効化を防げず不採用。

### ADR-0006  コードベースは OriginalCRM を複製し新リポ takng-cb/Bract へ統合
- 2026-06-07 / **採用**
- 文脈：CRM の資産を活かしつつ ERP モジュラー化を進める受け皿が必要。
- 決定：`OriginalCRM` を複製し、新規リポジトリ `github.com/takng-cb/Bract` に統合（main = CRM 全履歴）。旧 `Bract-CRM` には push しない。
- 理由：既存3業種の資産を全継承。本番 CRM リポへの混入を防ぐ。
- 影響：全体。`CLAUDE.md` 開発標準。
- 代替案：OriginalCRM 上で直接発展 → 本番に影響しうるため却下。

### ADR-0007  人材手配システムは Bract の `staffing` モジュールとして実装
- 2026-06-07 / **採用**（本セッションでユーザー合意。すり合わせ資料 `docs/staffing-alignment.html` A1）
- 文脈：人材手配ブリーフを独立プロダクトにするか、Bract に統合するか。
- 決定：Bract の `staffing` 業種モジュール＋AI入力補助(L1) として実装。
- 理由：単一企業向け＝Bract 単一テナントと一致。clients/agencies/talents/job_orders/candidates/粗利は既存 staffing スキーマでほぼ表現済み。目玉のコピペ→AI は draft-then-apply と同一。二重投資回避。
- 影響：REQ-0005 ほか staffing 系。`docs/staffing-alignment.html`, `specs/staffing.md`。
- 代替案：完全独立プロダクト → 二重投資のため却下。

### ADR-0008  データアクセスは既存の Drizzle/Neon を維持（supabase-js+RLS に乗り換えない）
- 2026-06-07 / **採用**（本セッションでユーザー合意。`docs/staffing-alignment.html` A2）
- 文脈：人材手配ブリーフは Supabase Postgres + RLS を想定。Bract は既に Neon + Drizzle + Supabase Auth。
- 決定：既存 Drizzle ORM を使用。権限分離はアプリ層ロール＋1社1DB 物理分離。RLS は任意の追加防御として保留。
- 理由：既存資産（schema.ts 一本・全業種コード・マイグレ・`check:schema`・SQL pushdown）を再利用。型安全。サーバー中心モデルに適合。単一テナントでは RLS の主目的（行分離）が不要。
- 影響：REQ-0005, REQ-0008。Drizzle ≠ Supabase 排他（Drizzle は任意の Postgres で動く）。
- 代替案：supabase-js + RLS → 完全独立プロダクト化する場合に再考。

### ADR-0009  人材手配を先に作り込み、基盤のレジストリ化は後追い
- 2026-06-07 / **採用** → **2026-06-08 Superseded by ADR-0016**（ERP本格化に伴いレジストリ先行へ転換）
- 文脈：モジュール配電盤（レジストリ：`MODULE_REGISTRY`/`isModuleEnabled`/`/admin/modules`、`activeIndustry`→ランタイム判定 = erp-architecture Phase1-2）を先に作るか、人材手配機能を先に作るか。
- 決定：既存の業種オーバーレイ（`activeIndustry`）の上で **人材手配(staffing) を先に完成**させ、レジストリ化（Phase1-2）は後追いで実施する。
- 理由：最優先は「動く人材手配」。当面 staffing 1本のためレジストリの真価（複数モジュール組合せ）は急がない。ストラングラー方式どおり実物→土台の順が手戻り少。レジストリ化は設計上いつでも安全に追加可能。
- 影響：REQ-0005。開発順はブリーフ Phase1→6（spec:staffing §10）。レジストリ化は別途 migration-roadmap Phase1-2 として保留。
- 代替案：レジストリ化を先（A案）→ 顧客価値が遅れるため不採用。

### ADR-0010  単価は「案件固定単価」を主とし、登録後も変更可能にする
- 2026-06-07 / **採用**（OPEN-C1）
- 文脈：既存 staffing は時給ベース、ブリーフは案件固定単価。また単価は後から変えたいとの要望。
- 決定：発注単価(client_rate)・提示単価(proposed_rate) を**案件ごとの固定額**として持ち、**登録後も編集可能**にする。粗利＝発注−提示は確定単価から都度再計算。時給は任意項目として残す。
- 理由：手配業務は交渉で単価が動くため、後から修正できる必要がある。
- 影響：REQ-0005, REQ-0007 / spec:staffing §4,§8。請求済み後の単価変更時の扱い（再計算/履歴）は実装時に詳細化。
- 代替案：登録後ロック → 実運用に合わず不採用。

### ADR-0011  自動リマインド（Cron＋メール通知）は MVP スコープ外
- 2026-06-07 / **採用**（OPEN-B1）
- 文脈：スケジュール＋自動リマインドが要件にあったが、まずは外したい。
- 決定：Cron＋メールによる自動リマインドは **MVP に含めない**。予定(events)の記録/表示は任意で残すが、自動通知は作らない。
- 理由：MVP の価値の中心ではなく、まず手配業務の中核を優先。通知は後から安全に追加可能。
- 影響：REQ-0006 を縮小。**C2（メール送信=Resend）は MVP 不要→保留**、Vercel Cron 不要。
- 再開条件：運用開始後に通知ニーズが顕在化したら復活。

### ADR-0012  クイック登録で個人情報を含む本文を LLM(Gemini) に送信する（安全策つき）
- 2026-06-07 / **採用**（OPEN-C3）
- 文脈：貼付した LINE 本文には氏名・連絡先等の個人情報が含まれる。クイック登録は本文を解析する性質上、本文を LLM に渡す必要がある（対象データを送らないと成立しない）。
- 決定：個人情報を含む本文の **LLM 送信を許可**（機能上必須）。ただし以下の安全策を必須とする：
  - サーバー側のみで送信（鍵・本文をクライアントへ出さない）
  - 解析に必要な本文・文脈のみ送る（無関係な DB 上の個人情報は付加しない）
  - 学習に使われない設定／東京リージョン（Vertex AI 等）を優先し、`lib/ai/providers` 抽象で切替可能に
  - 不要な外部保持をしない（生本文は自社 DB の `raw_message` として保持、外部保持は最小）
- 理由：本文解析が機能の中核。リスクは送信経路・保持・リージョンの管理で低減する。
- 影響：REQ-0004, REQ-0008 / spec:staffing §6,§9。
- 備考：もし「氏名等はマスキングして送る」方針が希望なら本 ADR を Supersede する（要連絡）。

### ADR-0013  Gemini API キーは Vercel 環境変数（env 固定）で保持
- 2026-06-07 / **採用**（OPEN-B4）
- 文脈：鍵を env 固定か DB 固定（/admin/ai 暗号化保存）か。
- 決定：サーバー専用の Vercel 環境変数 `GEMINI_API_KEY`（`NEXT_PUBLIC_` 無し）で保持。一度登録すれば全ビルド/デプロイで永続。交換時のみ再デプロイ1回。
- 理由：最もシンプル・安全（鍵が DB に残らない）。鍵を頻繁に変えない運用前提。
- 影響：REQ-0008 / spec:staffing §6。`.env.example` に追記。
- 代替案：DB 固定（既存 /admin/ai） → 顧客自身が鍵を交換する運用が必要になれば移行（providers 抽象で安価）。

### ADR-0014  統合版 Bract は当面「開発(dev)環境」として運用
- 2026-06-07 / **採用**（OPEN-D2）／ **2026-06-14 本番2本については ADR-0028 で Supersede**（real-estate/auto-body を新リポ本番化。dev 環境の位置づけ自体は base/検証用として残る）
- 文脈：統合版 `takng-cb/Bract` を実サーバーで動かすにあたり、本番か検証用かを決める必要があった。
- 決定：統合版 Bract は当面 **開発/検証(dev)環境**として 1 つ立てる。**専用の dev Neon ＋ 専用 Vercel project**。既存2本番（real-estate `bract-crm` / auto-body `bract-crm-auto-body`）は**触らず**現行のまま。
- 理由：本番に無影響でモジュラー化・人材手配を検証できる。dev データは使い捨て可能で安全。
- 影響：REQ-0009 / docs/deployment-runbook.md。本番への寄せ替え（OPEN-D1）は別途・準備完了後。
- 代替案：いきなり本番投入 → リスク高で不採用。

### ADR-0015  Git/Issue 運用は Gitflow ＋ OriginalCRM の型を踏襲
- 2026-06-07 / **採用**（ユーザー指示）
- 文脈：新リポ `takng-cb/Bract` の運用を、旧 OriginalCRM(Bract-CRM) で固まっていた形に揃えたい。
- 決定：
  - **ブランチ＝Gitflow**：`main`(本番) / `develop`(統合) を恒常、`feature/* | fix/* | chore/*` は **develop から切って develop へ PR**。`develop → main` は `--no-ff`。
  - **Issue 運用**：タイトルは `[scope] 説明`（scope 例：platform / staffing / ops / chore / base / auto-body / enterprise）。`priority:blocker/high/medium/low` ラベルを付与。umbrella Issue で束ねる。本文は不具合=症状/原因/修正/検証/副次、機能=要件記述。`REQ-/ADR-/#Issue` で相互参照。
  - 新リポに旧と同じカスタムラベル（priority:*, dependencies）を整備。
- 理由：既存の運用知見を継承し、新メンバーの学習コストを下げる。
- 影響：CLAUDE.md §3 / AGENTS.md「ブランチ運用」「Issue 運用」。

### ADR-0016  モジュールレジストリ先行（ADR-0009 を Supersede）
- 2026-06-08 / **採用**（④ レジストリ先行→ERP）
- 文脈：ERP（在庫・会計等）は**業種横断**で、業種オーバーレイ上に載せると無理が出る。ERP を本格化するなら綺麗な土台が要る。
- 決定：**#10/#11（モジュールレジストリ＋ランタイム・ゲーティング＋/admin/modules）を先に実装**し、その上に staffing・ERP の各モジュールを載せる。ADR-0009（staffing 先行・レジストリ後追い）を転換し、レジストリ先行とする。
- 補足：staffing の**データ層（#15 スキーマ＋マスタ）はレジストリ非依存のため並行可**。UI/ゲートはレジストリ上に載せる。
- 影響：docs/migration-roadmap.md の順序、#9/#10/#11/#14/#15。

### ADR-0017  「オブジェクト」呼称は全面リネーム（コード/DB/ルート/データ含む）
- 2026-06-08 / **採用（方針）・新名称は確定待ち**（①）
- 文脈：Salesforce 感を避けたい。表示名のみ変更案は不採用、内部まで揃える方針。
- 決定：`object_definitions`/`field_definitions`/`custom_records`/`/admin/objects`/`/objects/*`/「カスタムオブジェクト」等を、新名称に**全面リネーム**（api_name・テーブル名・ルート・コード識別子・データ移行を含む）。
- 留意：高コスト・広範囲（DB移行＋ルート互換＋全コード置換＋ドキュメント）。**専用Issue＋段階移行**で実施。互換のため旧ルートは一定期間 redirect 推奨。
- 新名称：**ブック（Book）**。語彙階層は ADR-0018（モジュール > ブック > レコード）。
- 影響：広域。レジストリ実装(#10)前に名称確定できれば、新名称ベースで作れて手戻り減。

### ADR-0018  ドメイン語彙：モジュール > ブック > レコード（「オブジェクト」→「ブック」）
- 2026-06-08 / **採用**（① 新名称。レコード呼称など細部は確認中）
- 文脈：Salesforce 的な「オブジェクト」を避け、Bract 独自の分かりやすい語彙にしたい。
- 決定：概念階層を **モジュール（機能パッケージ）> ブック（旧オブジェクト＝データの種類/表）> レコード（ブック内の1件）** とする。
  - 「オブジェクト」→ **ブック（Book）**。`object_definitions` → ブック定義（例：`book_definitions`）、`/admin/objects` → ブック管理、`/objects/*` → `/books/*` 等。
  - 各ブックは**所属モジュール**を持つ（#10 のモジュールと統合）。例：CRM モジュール ⊃ 取引先ブック/商談ブック、在庫モジュール ⊃ 商品ブック/倉庫ブック。
  - 「項目（field）」は現状どおり **項目**。「レコード」は暫定で **レコード**（要確認：エントリ/ページ 等）。
- 理由：帳簿(books)の比喩は ERP と好相性、CRM でも自然、SF 感が無い。モジュール階層と一体化し、モジュラー設計を語彙レベルで体現。
- 影響：ADR-0017（リネーム対象＝ブック）、#21、#10。**#10 と #21 は統合的に実装**するのが自然（モジュールがブックを束ねる）。
- 確定（2026-06-08）：レコード＝「レコード」／項目＝「項目」／「モジュール」は #10 レジストリのモジュールと**統合**（crm-core・在庫・real-estate 等）／**ビルトインもブック**（ビルトイン/カスタムはフラグで区別）。UI ラベルの最終文言のみ実装時に詰める。
- 既存業種（real-estate / auto-body / staffing）は `category:'industry'` のモジュールとしてまとめ、各々が自分のブック群を持つ（ADR-0001 と整合。物理移設は #13 / 統合実装は #10）。

### ADR-0019  ブックがモジュールをまたぐ問題の解消（所有・依存・参照ルール）
- 2026-06-08 / **採用**（モジュール ⊃ ブック モデルの整合性確保）
- 文脈：共有ブック（取引先/人物/活動 等）は多数のモジュールが使い、商談ブックは営業所有だが不動産/板金が項目を追加する。「1ブック=1モジュール所有」だけでは破綻する。
- 決定（3＋1 ルール）：
  1. **基盤ブックは土台モジュールが所有＋依存**：取引先/人物/活動/ToDo は crm-core（or platform）所有。各モジュールは `dependsOn` で依存を宣言（例：real-estate → crm-core, sales）。
  2. **依存解決で連鎖事故を防ぐ**：`getEnabledModules` が依存先を自動的に有効化（依存されているモジュールは無効化不可、UI で警告）。
  3. **項目はそれを追加したモジュールが所有**：ブックは「所有モジュール」を1つ持つが、**項目（field）ごとに所有モジュール**を持てる。商談ブックの不動産項目は real-estate 所有。real-estate 無効化＝その項目だけ非表示、ブック本体は無事。
  4. **参照は依存範囲内のみ**：モジュール A がモジュール B のブックを参照するなら A `dependsOn` B。レジストリで検証し、宙ぶらりん参照を防ぐ。
- データモデルへの含意：ブック定義（旧 object_definitions）に `owning_module`、項目定義（field_definitions）に `owning_module` を持たせる。拡張項目は Phase6 の拡張テーブル分離（opportunities_*_ext）と整合。
- 影響：#10（レジストリ）, #21（ブック）, #13（業種移設）, Phase6。`ModuleManifest.dependsOn` を前提にする。

### ADR-0020  重複登録は「ブロック」でなく「確認画面」、自然キーは共通レジストリで管理
- 2026-06-08 / **採用**（REQ-0018）
- 文脈：取引先や担当者・案件などが重複登録される事故を防ぎたい。一方で「同名でも別物」（同名の別取引先、同日別案件）は正当に存在する。完全ブロックは誤検知で業務を止める。
- 決定：
  1. **検出 → 確認画面**：新規作成時に自然キーで既存を探し、見つかれば作成を保留して確認 UI を出す（`CreateState.kind='duplicate'`）。ユーザーが「既存を開く」か「それでも新規作成」を選ぶ。後者はフォーム hidden `__allow_duplicate=1` で検査をスキップ。
  2. **自然キーは 1 箇所に集約**：`src/lib/duplicateCheck.ts` の `RULES`（組み込み）＋ `custom:<api>`（カスタムは主フィールド）で定義。create アクションは `runCreate()` ラッパーを呼ぶだけ。フォームは共通 `<CreateFeedback>` を置くだけ（`useActionState<CreateState>`）。
  3. **案件はタイトル完全一致**：案件は自然キーが弱いので「取引先名＋日付＋内容」で生成するタイトルの完全一致で判定。`createAssignment` も同じ `buildAssignmentTitle` で title を保存し、両経路で一貫させる。
  4. **対象外**：ToDo・活動は繰り返し登録が正当なため自然キー未定義（＝検査なし）。必要になれば RULES に追加するだけ。
- 代替案：DB UNIQUE 制約での完全ブロック（誤検知で業務停止・同名別物を表現できないため不採用。part_number 等 既存 UNIQUE はそのまま温存）。
- 影響：全 `*/new` フォーム（accounts/contacts/opportunities/assignments/vehicles/parts/properties/custom）。クイック登録は別 UI だが思想は同一（PR#33）。

### ADR-0021  デザイン刷新は「トークン集約＋段階移行（zinc/blue リマップ）」で進める
- 2026-06-08 / **採用**（REQ-0020）
- 文脈：Claude Design が Tailwind v4 `@theme` のトークン（warm neutral `n-*`／brand `brand-*`／semantic）を作成。だが既存コードは `zinc-*`/`blue-*` を数百箇所で直書きしており、全置換は一度には不可能。すぐに全画面へブランドを反映したい。
- 決定：
  1. **真実は globals.css の @theme**：`design_handoff/export/globals.css` を `src/app/globals.css` に適用（トークン・ダーク・base reset・focus ring）。原本一式は `design_handoff/` に保存。
  2. **段階移行のため zinc/blue をリマップ**：`--color-zinc-*: var(--color-n-*)` / `--color-blue-*: var(--color-brand-*)` を @theme で上書き。既存ユーティリティが書き換え無しで新パレットを採用（全画面が一括でブランド化）。以降のスライドで意味トークン（semantic/Badge tone）へ順次置換。
  3. **フォント不具合解消**：body の Arial 上書きを撤廃し `--font-sans = Geist → Noto Sans JP → system-ui`。`layout.tsx` で Noto Sans JP を next/font 追加。`lang` を ja に。
  4. **段階の順序**：①基盤（本PR）→ ②lucide アイコン → ③共通プリミティブ（Badge/Button/Input/Card）→ ④画面個別。各スライドは独立リリース可能。
  5. **据え置き**：和文 `line-height:1.7` の全体適用は密度の高い業務テーブルへの回帰リスクがあるため基盤では入れず、画面個別で調整。ダークは class 戦略で土台のみ用意（既定はライト）。
- 影響：`src/app/globals.css`・`layout.tsx`。見た目のみ（機能・URL・サーバーアクション不変）。

### ADR-0022  レコード承認は「汎用 approval レイヤー＋条件ルーティング＋多段」で実装
- 2026-06-10 / **採用**（REQ-0023 / 会話で論点を確定）
- 文脈：高額経費・商談の値引き・整備見積など、レコードに「必要に応じた承認」を付けたい（#85）。ブックごとにスキーマ列を足す方式（拡張性低）や、既存 status/矢羽根に混ぜる方式（ライフサイクルと承認が混在）は不採用。
- 決定：
  1. **汎用 approval レイヤー**：`approvals` テーブル（polymorphic：`object_type, object_id, status, requested_by, approver_id, step, decided_at, comment`）を新設。既存の polymorphic 関連・`change_logs`・通知基盤（Discord）を流用。レコード側にスキーマ列は足さない。
  2. **適用範囲＝全ブックで設定可能**：typed ブック（整備/商談/経費…）もカスタムブックも、ブック単位で承認を ON/OFF。承認設定はブック設定（object_definitions 側のメタ or 専用 `approval_configs`）に保持。
  3. **条件ルーティング**：承認要否・承認者は **金額に限らずブックの任意フィールドを条件**にできるルールで決める（例：`amount >= 100000` AND `type = '値引き'` → 部長承認）。ルールは順序付きで評価し、最初にマッチしたルートを採用。
  4. **多段（最初から）**：申請 → step1 → step2 … の順序付き多段。各 step に承認者（ユーザー/ロール指定）。全員承認 or いずれか承認は step ごとに指定可。差戻しは申請者へ戻す。
  5. **承認待ち中は編集ロック**（差戻しで解除）。承認後の変更は再申請扱い。却下後の再申請は可。承認の取消は admin のみ。
  6. **承認者は指定方式**（`approver` ロールは新設しない）：ブック/ルートごとにユーザーまたは既存ロールを指定。
  7. **UI**：レコード詳細に承認バッジ（未申請/承認待ち/承認済/差戻し）＋権限に応じた申請/承認/差戻しボタン。「自分が承認すべき」一覧をダッシュボードウィジェット＋ナビに。
  8. **通知**：申請/結果をアプリ内＋Discord。監査は `approvals`（誰がいつ各 step を承認/差戻し）＋ `change_logs` 併用。
- 代替案：(B) レコードに承認専用 status 列＝ブックごとスキーマ追加で拡張性低・不採用。(C) 既存矢羽根に承認を組み込む＝ライフサイクルと承認が混ざり不採用。
- 段階：Phase1＝単一ブック（例：経費）で単純条件＋単段相当のルートを通し基盤確立 → Phase2＝多段・複数条件・全ブック設定 UI → Phase3＝承認待ちウィジェット/一覧の高度化。
- 影響：新規 `approvals` / `approval_configs`（or object_definitions メタ）, 各詳細ページ（承認バッジ＋ボタン）, ダッシュボード/ナビ, 通知, 権限チェック。#85。モジュール化(#10/#11)とは独立に進行可。

### ADR-0023  RBAC は「roles＋role_permissions（ブック×CRUD）＋既存3ロールの system role 化」で段階導入
- 2026-06-11 / **採用**（REQ-0031。論点①②③確定：①Read もブック別制御 ②既存3ロールは system ロールとして維持しカスタム追加 ③Phase1+2（基盤＋CRUD 強制）まで実装）
- 文脈：ロールごとにブック単位の CRUD 権限を設定したい。現状は users.role の固定3値（admin/editor/viewer）で全ブック一律。
- 方針案：
  1. **`roles` テーブル新設**（id, name, description, is_system）。既存 admin/editor/viewer は **system ロール**として行を持たせ後方互換（admin=全権・editor=全ブックCRUD・viewer=全ブックRead）。
  2. **`role_permissions` テーブル**（role_id, book_api, can_create/can_read/can_update/can_delete）。book_api='*' のワイルドカード行で既定を表現し、ブック行で上書き。
  3. **users.role_id** を追加（既存 users.role テキストは移行期間中フォールバックとして併存＝ストラングラー）。
  4. **判定ヘルパ**：`canDo(bookApi, op)` / `requirePermission(bookApi, op)` を src/lib/auth に追加。既存 `requireEditor()` は当面 `canDo(book,'update')` 相当へ内部委譲し、server actions をブック単位ガードに順次置換。
  5. **UI**：/admin/roles（ロール一覧・作成・ブック×CRUD のマトリクス編集）＋ /admin/users でロール割当。read=false のブックはナビ・検索・一覧からも非表示。
  6. **段階**：Phase1＝テーブル＋system ロール移行＋ロール管理 UI（挙動非変更） → Phase2＝server actions のブック別 enforcement ＋ UI ゲーティング → Phase3＝フィールド単位など細粒度（将来）。
- 未確定（ユーザー確認中）：①Read もブック別に制御するか ②既存3ロールを残しカスタムロールを追加する形でよいか ③フィールド単位制御は将来送りか。
- 影響：users / 新規2テーブル / src/lib/auth / 全 server actions（段階置換）/ ナビ・一覧・詳細の表示ゲート / #85 の承認者指定。







### ADR-0024  リリースは「顧客別 release ブランチ（release train）」方式で運用
- 2026-06-12 / **採用**（#130 オーナー決定。REQ-0053）
- 文脈：複数顧客（1社=1 Vercel + 1 Neon + 1 Supabase）への継続リリース方式の決定。観点は ①リリース容易性 ②顧客ごとの順次展開・据え置き ③顧客間セキュリティ ④運用の楽さ。
- 決定：
  1. `main`＝開発・即時（dev/カナリアが追従）。顧客ごとに `release-<Customer>` ブランチを持ち、各顧客の Vercel Production Branch がそれを追従する。初期3顧客: **release-ProjectID（板金のみ）/ release-Cactus（ERP＋不動産）/ release-Yamamoto（人材手配）**。
  2. **release ブランチはコードを分岐させない**（検証済み main の特定時点を指すポインタ。進めるのは `--ff-only` merge のみ。例外は重大 hotfix の cherry-pick）。
  3. 顧客差分はブランチではなく**ランタイム設定**で表現: `NEXT_PUBLIC_INDUSTRY` ＋ `licenses.features.enabled_modules`（ADR-0001/0002 のモジュールレジストリ）。
  4. マイグレーションは「**全 Neon 適用 → release を進める**」の順序を固定（据え置き顧客の Neon にも先に適用。後方互換マイグレ必須＝既存ルール維持）。
  5. 据え置き＝release を進めない、ロールバック＝release を前タグへ reset。いずれも Vercel 設定や再ビルド不要。
- 却下案：案A（全顧客 main 追従）＝据え置き不可・同時破壊リスク。案C（顧客別フォーク）＝ドリフトとマージ地獄。
- 影響：ブランチ運用（AGENTS.md）/ docs/release-runbook.md（新設・運用手順の真実）/ 顧客コンテナ provisioning チェックリスト。
- 残論点（#130 チェックリスト）：release train の周期、hotfix SLA の明文化、バージョン表記（フッタ vX.Y.Z）、顧客向けリリースノート運用。

### ADR-0025  業務報告は「テンプレ集約レポート(Phase1)→一括報告インボックス(Phase2)」で実装
- 2026-06-13 / **採用**（#88。設計ドラフト docs/design-88-business-reporting.md の推奨案をオーナーが承認）
- 決定：
  1. **Phase 1 = 案B**: テンプレート選択式の期間集約レポート。対象（案件/商談）と期間を選ぶと、紐づく活動・ToDo を AI が要約してレポート生成。**その場生成＋コピーのみ**（保存・履歴は Phase 3 へ後ろ倒し）。テンプレは個人＋全員共有の2層（共有の編集は admin のみ）。新規テーブルは report_templates のみ（冪等 migration・全 Neon 適用）。
  2. **Phase 2 = 案A**: 一括報告インボックス。**独立ページ**（モバイル PWA からワンタップ）にテキストを貼り付け → AI が案件別に分割 → draft-then-apply で複数活動を一括登録。上限 10 件/回、関連先が解決できない項目は未紐づけのまま作成。**音声入力は後回し**（テキストのみで開始。Web Speech / Whisper は反応を見て判断）。
  3. **関連先の対象ブックは assignments（案件）＋ opportunities（商談）から開始**（整備・物件は拡張枠）。
  4. 出力は画面表示＋コピーで開始。Discord 送信は Phase 3、PDF/承認連携は別 Issue。
- 却下/保留：案C（LINE/メール転送の外部入力）は運用・セキュリティ整理が重く見送り。
- 根拠：オーナー方針「報告は案件単位・活動にためて要約をレポート出力」（#88 コメント）と draft-then-apply 原則（CLAUDE.md）に整合。
- 影響：report_templates（新規）/ src/lib/ai/summarize.ts の流用 / quickAi 系の分割抽出拡張 / 独立ページ＋モバイル下部タブ候補。
- 進捗（2026-06-13）：**Phase 1 実装済み**（REQ-0072 / feature/report-phase-1）。report_templates＋generateReport＋ReportButton を案件・商談詳細に配置。Phase 2（一括報告インボックス）は未着手。

### ADR-0026  会計は「本格会計」をやらず「前処理＋会計ソフト連携」で実装
- 2026-06-13 / **採用**（REQ-0068。オーナー決定「本格会計はやめて、Phase D でいきましょう」）
- 文脈：領収書画像→自動仕訳・仕訳管理の要望に対し、①本格会計（決算・申告まで内製） ②前処理＋会計ソフト連携 の 2 案を比較。
- 本格会計を却下した理由：
  1. 税制・インボイス・電子帳簿保存法への**永続的な追従コスト**（freee/弥生は専任チームで対応している領域）。
  2. 申告は結局 税理士＋既存会計ソフトに渡すため、**連携はどのみち必要**＝本格会計は二重投資。
  3. 仕訳・税額の誤りは顧客の納税額に直結し、**責任とテスト水準が CRM と別次元**。
  4. 固定資産・銀行連携・部門別…と**スコープが雪だるま式に膨張**する。
  5. 年度・締め・残高というステートフルなデータが増え、単一テナント×全 Neon マイグレ運用の負荷が上がる。
- 決定：
  1. Bract は**現場の入力と前処理**に徹する：領収書画像→経費起票（Phase A）→仕訳ドラフト（Phase B）→科目推定＋月次集計（Phase C）→freee/弥生 CSV エクスポート（Phase D）。
  2. **消費税は計算しない**。税率・税区分を項目として保持し、計算・申告は連携先に委ねる。インボイス登録番号は保持＋形式チェックのみ。
  3. 仕訳（journal_entries）は「会計ソフトに渡す前の**中間表現**」として設計し、将来方針が変わっても同じ土台を使えるようにする。
  4. `accounting` モジュール（category: 'erp'）として実装し、`enabled_modules` でランタイム ON/OFF。AI は draft-then-apply 原則を維持。
- 影響：#134（実装 umbrella）/ docs/design-134-accounting.md（設計）/ expenses へのレシート項目追加（vendor / tax_rate / invoice_reg_no）。


### ADR-0027  DB バックアップは「GitHub Actions 日次 → age 暗号化 → 段階的に GitHub artifact→R2＋顧客Drive」で運用
- 2026-06-14 / **採用**（#24。会話で方式を比較・厳しめレビュー込みで決定）
- 文脈：無料 Neon（リリース時に有料化予定）下で、リリース必須のバックアップ運用をどう実現するか。観点は ①簡単・無料 ②非ローカル・オフサイト ③復元の確実性・改ざん耐性 ④多顧客への拡張。
- 決定：
  1. **自動化＝GitHub Actions の `schedule`（日次）**。pg_dump バイナリを動かせる無料・既存の仕組み。Vercel/CF Workers の cron は pg_dump 不可、自前VM/SaaS は重い/有料のため不採用。
  2. **暗号化＝age 非対称**。公開鍵のみ CI（`AGE_RECIPIENT`）、**秘密鍵は CI に置かず手元オフライン二重保管**（PWマネージャ＋封緘）。CI 侵害でも過去 dump は復号されない。鍵は当面全社共通→顧客増で per-tenant 分割。
  3. **保存先は段階移行**：段階1（アーリー・現在）＝暗号化 dump を **GitHub Actions artifact（30日）**（無料・非ローカル・Neon と別事業者）。段階2（本格リリース）＝**R2（Object-Lock 不変）主＋顧客指定 Drive へ暗号化副コピー（3-2-1）＋Neon 有料 PITR を一次復旧**。保存先は抽象化して差し替え。
  4. **ローカルのみ保存は不採用**（単一コピーはバックアップでない）。**顧客 Drive を唯一の保存先にしない**（可用性が顧客環境依存＝復元できないリスク）。機密性は暗号化で担保できるため主は自社管理側が安全。
  5. **多テナント**：現状は repo secret `DATABASE_URL_*`（schema-check と共通）＋matrix。顧客増時は **GitHub Environments（`tenant-<slug>`）＋matrix** にスコープ分離。tenant=1フォルダ/1プレフィクス。
  6. **監視**：失敗時 Webhook 通知（`BACKUP_ALERT_WEBHOOK`）。「当日未着」は外部ハートビート（cron-job.org→`repository_dispatch`、`schedule` の60日自動無効化対象外）で補完。
  7. **復元リハ月1必須**（#24）。手順は docs/backup-runbook.md。
- 却下/代替：Vercel Cron・Cloudflare Workers（pg_dump 不可）/ 自前 VM・MinIO（運用重・独立性低）/ 管理型 SaaS（費用＋第三者に DB 認証情報）。
- 影響：.github/workflows/backup.yml（既存に age 暗号化＋失敗通知を追加）/ docs/backup-runbook.md（新規・生きた手順）/ docs/release-neon-rebuild.md §7（参照）。

### ADR-0028  本番2本（real-estate / auto-body）を新リポ takng-cb/Bract に移行（OPEN-D1 決定・ADR-0014 を一部 Supersede）
- 2026-06-14 / **採用・実行済み**（#18 / OPEN-D1。ユーザー指示で当日実行）
- 文脈：ADR-0014 で統合版 `takng-cb/Bract` は「dev 環境」とし既存2本番（旧リポ `Bract-CRM` 由来）は触らない方針だった（OPEN-D1＝本番寄せ替えは時期別途）。新リポが十分成熟し、本番を統合版へ寄せる判断が出た。
- 決定：本番 real-estate（Vercel `bract-crm`）/ auto-body（Vercel `bract-crm-car`）の **Connected Git を 旧 `Bract-CRM` → 新 `takng-cb/Bract`（Production Branch=main）へ張り替え**、統合版を本番化する。**ADR-0014 の「本番は触らない／統合版は dev 専用」を本2テナントについて Supersede**（統合版が本番の真実）。
- 実行手順（当日・安全策込み）：
  1. **事前にスキーマ整合を検証**：本番2 Neon に対し新リポ `schema.ts` で `check:schema` → 大きく遅れを検出（RE 13件 / AB 26件のテーブル・カラム欠落）。
  2. 各 Neon に**適用直前スナップショット**（`snapshot-db.ts`）＋当日の暗号化バックアップ（復号検証済み, ADR-0027）。
  3. **欠落分の冪等マイグレを `apply-migration.ts` で適用**（20260508+。`DO $$` を含む wiki.sql のみ `$$` 対応で別適用）。**デモデータ `seed_data.sql` は除外**（ライブ顧客 DB に架空レコードを入れない）。`seed-metadata` / `seed-maintenance-templates` を投入。
  4. `check:schema` 緑（両 exit 0。AB に無害な dbOnly 余剰列 `custom_record_id` のみ残存）→ `vercel-build` ゲート通過を担保。
  5. Vercel で Git 張り替え → 空コミットで再デプロイ → 両本番スモーク 36/36 pass。
- 理由：新リポを唯一の真実にし、旧 `Bract-CRM` の二重管理を解消。`vercel-build` の check:schema ゲートが未適用 DB へのデプロイをブロックするため、マイグレ先行で安全に寄せられる。
- ロールバック：Vercel の Connected Git を旧 `Bract-CRM` に戻して再デプロイ（DB 変更は加算的なので旧コードでも動作）。
- 留意：本番 URL は real-estate=`bract-crm.vercel.app` / auto-body=`bract-crm-car.vercel.app`（旧 `bract-car.vercel.app` は無効エイリアス）。旧リポ `Bract-CRM` は今後アーカイブ扱い（push しない）。
- 影響：Issue #18 / docs/deployment-runbook.md / README.md デプロイ表 / AGENTS.md（旧リポ非push 規律）。base 用 Neon・将来テナントは未移行（個別に同手順）。

### ADR-0029  レコード単位アクセス制御：principal 別の可視述語＋grant 実体化＋外部はポータル分離
- 2026-06-17 / **採用（設計）**（REQ-0083 / REQ-0084。会話で合意）
- 文脈：既存 RBAC（ADR-0023）は「ロール×ブックの CRUD」までで、レコード単位の可視性が無い。要求は2層：(1) 社内＝担当者×ロールでレコードを絞る、(2) 外部ユーザーを作り**特定レコードだけ**見せる（非信頼）。一覧は SQL pushdown（FilterColumnResolver）でページ/件数も DB 側で確定するため、可視性は**必ず SQL の WHERE 述語**で表現する必要がある（JS 後フィルタはページ/件数が壊れる）。
- 決定：
  1. **単一の可視述語生成関数 `visibleRecordWhere(book, op, principal)`** に集約し、principal 種別でポリシー分岐。`canDo`（ブック CRUD）と直交させ、両者 AND で最終可視性を決める。一覧・詳細・サーバアクション・検索・ダッシュボード・エクスポートの**全入口から共用**。
  2. **社内ポリシー**：`canDo(book,op)` ＋ ロール×ブック毎の**レコードスコープ** `all`（述語なし＝全件）/`own`（`owner_id = me`）。`team` は組織階層が必要なため将来（別 ADR）。既定 `all`＝現挙動で挙動非変更導入。スコープは `role_permissions` を拡張（`read_scope` / `write_scope` 列を追加、既定 `all`）。
  3. **外部ポリシー**：外部ユーザーはブック権限を**強制ゼロ（deny-by-default）**。可視は `record_grants` 付与行が在るレコードのみ：`EXISTS(record_grants WHERE object_api=book AND record_id=rows.id AND grantee_id=me AND (expires_at IS NULL OR expires_at>now()))`。owner フォールバックもロール全件も無し。
  4. **共有グラフ＝実体化（materialize）**：共有時に「含める関連子」を選ぶと**子ごとに record_grants 行を作る**。後から追加された関連は自動共有されない（＝「指定した関連子のみ」を満たし漏れない）。query は全種別で `EXISTS(record_grants)` に統一。ルールベースの実行時トラバースは漏れやすいため不採用。
  5. **外部の書き込みは本文と分離**：外部は本文編集・削除**不可**。許すのは (a) 共有レコードへの**添付追加**（既存 attachments＋grant チェック）、(b) **コメント追加**（軽量な新テーブル `record_comments(object_api, record_id, author_id, body, created_at)`）。
  6. **外部の入口はポータル分離**：`users.is_external`（または external system ロール）で principal を識別。**社内 (crm) ルートは外部を入口で全拒否→`/portal` リダイレクト**。`/portal` は最小ルート群（自分の grant 一覧／grant 検証済み詳細／ファイル・コメント追加）。認証基盤(Supabase)・DB・一部コンポーネントは流用。理由：非信頼ゆえ社内 UI 全体の封鎖は監査困難。専用面に限定すれば安全性を構造で担保。
- ストラングラー段階（各 Phase 独立リリース可）：
  - **Phase1（社内・低リスク）**：`visibleRecordWhere` 抽象＋`role_permissions.read_scope/write_scope`＋商談・取引先に own/all 適用。既定 all で挙動非変更。
  - **Phase2（外部・基盤）**：`is_external`＋外部ロール（全拒否）＋社内アプリの外部拒否＋`record_grants`＋ポータル（grant 一覧／読み取り詳細）。
  - **Phase3（外部・貢献）**：ポータルからファイル/コメント追加、社内詳細の「外部共有」パネル（共有先・含める子の選択・有効期限・取消）、監査ログ。
  - **Phase4（堅牢化）**：外部の全入口（検索/AI/エクスポート/Storage 署名URL/関連/ダッシュボード/ナビ）の閉塞をセキュリティレビュー＋テスト。
- 理由：可視性を 1 関数に集約することで入口ごとの実装ドリフト（＝漏れ）を防ぐ。既定 all による無影響導入で本番を守りつつ段階移行。grant 実体化で deny-by-default を維持。外部の専用面分離で非信頼 principal の監査範囲を最小化。
- 却下/代替：(a) ロール×ブックのみで妥協（レコード単位要求を満たさない）。(b) フルACL を社内にも全面適用（運用重・不要）。(c) 同一ログイン＋外部ロールで社内 UI を封鎖（数十ルート/アクションのいずれか1つの漏れが即漏えい＝監査困難）。(d) 共有のルールベース実行時トラバース（漏れやすい）。
- セキュリティ：外部=非信頼につき go/no-go(#40) に**「外部アクセスの脅威モデルレビュー＋封鎖テスト」を必須項目として追加**（直URL 404・非grant 操作拒否・検索/AI/エクスポート/Storage署名URL/関連 の閉塞）。
- 影響：src/lib/schema.ts（`role_permissions` 拡張・`record_grants`・`record_comments`・`users.is_external`）/ src/lib/permissions.ts（`visibleRecordWhere` 追加）/ 各一覧・詳細・actions / 新 `(portal)` ルート群 / spec: access-control / 既存 ADR-0023 を拡張（Supersede ではなく上に積む）。

### ADR-0030  関連先選択の「既存 or 新規」統一と PLAUD の AI作成統合
- 2026-06-18 / **採用（設計）**（REQ-0085。会話で合意）
- 文脈：関連先の選択UIが3系統（QuickLauncher 独自 / PlaudMultiImport 直叩き / RelatedRecordsPicker）に分散。「新規作成」導線が無く、該当なしはスキップ＝未紐付け。PLAUD複数案件は独自モーダルで通常AI作成と体験が分断、relatedName を既存照合せず精度も低い。
- 決定：
  1. **関連先の値を「既存 or 新規」の判別ユニオンで表現**：`{mode:'existing', object_api, record_id}` か `{mode:'new', object_api, name}`。確定時に new を先に作成（materialize）→ existing に解決して junction へ。途中キャンセルでゴミを残さない。
  2. **新規の型は AI 推論＋ユーザー変更可**。作成対象は当面 account/contact/opportunity/project（owner と専用ルートを持つ標準型）。
  3. **PLAUD をクイック操作のAI作成へ完全統合**：AI作成は「単一」「複数案件」を同じ確認パラダイムで扱う。複数案件時は draft カードのリスト（各 segment＝活動下書き＋関連先フィールド＋ToDo化）。`PlaudMultiImport` は廃止。
  4. **精度改善**：`segmentPlaudByCase` が segment ごとに relatedName＋relatedType を返す。サーバで既存検索→確信マッチは「既存」既定、無ければ「新規（推論型・その名前）」既定にして UI へ。ユーザーは確認・修正のみ。
  5. **段階導入**：Phase A=「既存or新規」関連先フィールド＋create-new materialize を**通常AI作成**に。Phase B=**PLAUD を QuickLauncher へ統合**（同フィールド再利用）。詳細ページの関連先編集(InlineRelatedRecordsEditor/フォーム)への展開は後続スライス。
- 理由：UIと型の3重化を解消し、「新規作成」を第一級にする。AI事前照合で「既存/新規」既定を正しくして手数と精度を改善。materialize でデータ衛生を保つ。
- 却下/代替：(a) その場で即新規作成（キャンセルでゴミ／重複）。(b) PLAUDを別モーダルのまま部品だけ共通化（「完全統合」要望に未達）。(c) 新規型を固定（案件の実態に合わない）。
- 影響：src/components/QuickLauncher.tsx（複数案件モード・関連先フィールド）/ 新 関連先フィールド部品 / src/app/actions/quickAi.ts（related を判別ユニオン化・create-new）/ src/app/actions/plaud.ts（relatedType＋既存照合）/ src/components/PlaudMultiImport.tsx 廃止 / 後続で RelatedRecordsPicker・InlineRelatedRecordsEditor。

### ADR-0031  AI作成のディールグラフ化（1入力→関連レコード一括作成）
- 2026-06-19 / **採用（設計）**（REQ-0086。会話＋AskUserQuestion で合意）
- 文脈：AI作成は「1入力→1ブック1レコード」。実務の入力（営業メモ等）は1文に取引先・商談・商品・活動が混在し、人手で複数画面を作り直す必要があった。
- 決定：
  1. **テキスト入力の AI作成をグラフ抽出に拡張**：`quickAiExtractGraph` が1回のAI呼び出しで複数レコード（accounts/contacts/opportunities(+商品明細)/activities/tasks）と**関係（account_ref/contact_ref/related_refs）**を持つ下書きを返す。ref はAIが付ける一時ID。
  2. **自動判定**：画像・URL単独・PLAUD・ブック確定済みは従来の単一フローのまま。プレーンテキスト（画像なし）のみグラフ抽出に回す。ノード1件でも同じ確認画面で扱う（入口を増やさない）。
  3. **draft-then-apply 厳守**：`QuickGraphConfirm` で各ノードをカード表示（編集可・除外可・既存照合の「既存に紐付け/新規作成」切替・商談は商品明細エディタ）。確定で `quickAiCreateGraph` が**依存順**（取引先→連絡先→商談→商品明細→活動/ToDo）に作成し FK/junction を配線、主レコード（商談優先）へ遷移。
  4. **既存照合**：account/contact/opportunity は名称一致候補を提示し既存紐付けを既定（REQ-0085）。商品明細は opportunity_products のフリー入力（実商品レコード不要）。
  5. **対象は当面コアCRM**（account/contact/opportunity/activity/task＋商談の商品明細）。車両・カスタム等は対象外（後続）。
- 理由：実務の1文＝1ディールという単位に合わせ、手数を最小化。単一AI呼び出しで関係まで取るため往復が少ない。確認画面を必須にして誤投入を防ぐ。
- 却下/代替：(a) 単一抽出を複数回（関係が取れず手配線）。(b) 即作成（誤りの一括登録リスク）。(c) 新規メニュー追加（入口分散・既存AI作成と二重化）。
- 影響：src/app/actions/quickAi.ts（quickAiExtractGraph / quickAiCreateGraph）/ src/components/QuickLauncher.tsx（aiGraphConfirm ステップ・runExtract 分岐）/ 新 確認カード部品。opportunity_products を再利用。
