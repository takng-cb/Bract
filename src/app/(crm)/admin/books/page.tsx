import { getAllObjectDefs, getCustomObjectsForNav } from '@/lib/objectMetadata'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { deleteObjectDef } from '@/app/actions/objectDefinitions'
import DeleteButton from '@/components/DeleteButton'
import NavOrderEditor from '@/components/NavOrderEditor'
import { getNavOrderSettings } from '@/app/actions/navSettings'
import { ALL_NAV_ITEMS, BOTTOM_NAV_ITEMS, customObjectsToNavItems, buildExtraNavItems } from '@/lib/navItems'
import { buildNavGroups } from '@/lib/navOrder'
import { activeIndustry } from '@/lib/industry'
import ActivityTypesEditor from '@/components/ActivityTypesEditor'
import { getActivityTypes } from '@/lib/activityTypes'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'
import { MODULE_REGISTRY, ALWAYS_ON, getEnabledModules } from '@/lib/modules/registry'
import type { ModuleCategory } from '@/lib/modules/types'
import { getLicense } from '@/lib/license'
import ModuleToggle from '@/components/ModuleToggle'
import { getProductBookCandidates, getOpportunityProductBooks } from '@/lib/opportunityProductBooks'
import { saveOpportunityProductBooks, saveMobileBottomNav, saveBoardClosedWindow } from '@/app/actions/settings'
import { getSystemSettings } from '@/lib/systemSettings'
import { getApprovalConfigs, getApprovalAdminData, getApprovalBooks } from '@/lib/approvals'
import ApprovalRulesEditor from '@/components/admin/ApprovalRulesEditor'

// ライセンス/モジュール有効状態を実行時に読むため動的レンダリング
export const dynamic = 'force-dynamic'

/**
 * /admin/books — ブック/モジュール管理（旧: オブジェクト管理 ＋ モジュール構成 #21/#10）
 *
 * 語彙階層「モジュール ＞ ブック ＞ レコード」（ADR-0018）に合わせ、
 * モジュールごとにブックをグルーピングして表示し、モジュールの有効/無効も
 * この画面で切り替えられる（/admin/modules はここへ統合）。
 */
const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  platform: '基盤', crm: 'CRM', erp: 'ERP', industry: '業種',
}
const CATEGORY_ORDER: ModuleCategory[] = ['platform', 'crm', 'erp', 'industry']
const CATEGORY_COLOR: Record<ModuleCategory, string> = {
  platform: 'bg-zinc-100 text-zinc-700',
  crm: 'bg-blue-100 text-blue-700',
  erp: 'bg-emerald-100 text-emerald-700',
  industry: 'bg-amber-100 text-amber-700',
}

export default async function AdminObjectsPage() {
  await requireAdmin()

  const [objects, { userOrder, systemOrder }, customObjects, activityTypes, enabledModules, lic, productBookCandidates, productBooks, approvalConfigs, approvalAdminData, approvalBooks, mobileNavSettings] = await Promise.all([
    getAllObjectDefs(),
    getNavOrderSettings(),
    getCustomObjectsForNav(),
    getActivityTypes(),
    getEnabledModules(),
    getLicense(),
    getProductBookCandidates(),
    getOpportunityProductBooks(),
    getApprovalConfigs(),
    getApprovalAdminData(),
    getApprovalBooks(),
    getSystemSettings(['mobile_bottom_nav', 'board_closed_window_months']),
  ])
  const productBookSet = new Set(productBooks)

  const enabledIds = new Set(enabledModules.map((m) => m.id))
  const entitled = (lic?.features as { entitled_modules?: string[] } | undefined)?.entitled_modules
  const alwaysOn = new Set<string>(ALWAYS_ON)
  const modules = Object.values(MODULE_REGISTRY)
    .slice()
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name, 'ja'),
    )

  // api_name → book_definitions 行（フィールド管理リンク用）
  const objByApi = new Map(objects.map((o) => [o.api_name, o]))
  // どのモジュールにも属さないブック＝カスタムブック
  const moduleBookApis = new Set(modules.flatMap((m) => (m.books ?? []).map((b) => b.apiName)))
  const customBooks = objects.filter((o) => !moduleBookApis.has(o.api_name))

  // ナビ並び替えに渡すグループ構造（layout.tsx のサイドバー構築と同じ手順で組み、ドリフトを防ぐ）
  const customNavItems = customObjectsToNavItems(
    customObjects.filter((o) => o.nav_enabled),
    activeIndustry,
  )
  const navGroups = buildNavGroups(enabledModules, buildExtraNavItems(customNavItems, activeIndustry))

  // モバイル下部タブの候補と現在値（REQ-0041）
  const bottomNavOptions = [
    ...ALL_NAV_ITEMS.filter((i) => i.href === '/dashboard'),
    ...navGroups.flatMap((g) => g.items),
    ...BOTTOM_NAV_ITEMS,
  ].filter((i, idx, arr) => arr.findIndex((x) => x.href === i.href) === idx)
  let bottomNavCurrent: string[] = ['/dashboard', '/accounts', '/tasks', '/activities']
  try {
    const p = JSON.parse(mobileNavSettings.mobile_bottom_nav)
    if (Array.isArray(p) && p.length === 4) bottomNavCurrent = p
  } catch { /* use defaults */ }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
      <PageHeader
        icon="🗂️"
        title="ブック/モジュール管理"
        description="モジュールの有効/無効と、各モジュールのブック（データ種別）・フィールド・サイドバー並び順を管理します"
        className="mb-0"
        actions={
          <Link
            href="/admin/books/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            ＋ 新規ブック
          </Link>
        }
      />

      {/* ── モジュールごとのブック一覧（モジュールの ON/OFF つき） ── */}
      <div className="space-y-4">
        {modules.map((m) => {
          const on = enabledIds.has(m.id)
          const books = m.books ?? []
          return (
            <section
              key={m.id}
              className={`rounded-xl border shadow-xs overflow-hidden ${on ? 'border-zinc-200 bg-white' : 'border-zinc-200 bg-zinc-50 opacity-70'}`}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-zinc-900 truncate">{m.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLOR[m.category]}`}>
                    {CATEGORY_LABEL[m.category]}
                  </span>
                  <span className="hidden sm:inline text-xs text-zinc-400 font-mono truncate">{m.id}</span>
                </div>
                <ModuleToggle
                  moduleId={m.id}
                  on={on}
                  locked={alwaysOn.has(m.id) || (!on && entitled !== undefined && !entitled.includes(m.id))}
                  lockedReason={alwaysOn.has(m.id) ? '常時有効' : '契約外'}
                />
              </div>
              {books.length === 0 ? (
                <p className="px-4 py-3 text-xs text-zinc-400">このモジュールにブックはありません</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {books.map((b) => {
                    const obj = objByApi.get(b.apiName)
                    return (
                      <div key={b.apiName} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <NavIcon icon={obj?.icon} className="w-4.5 h-4.5 text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 text-sm truncate">{obj?.label_plural ?? b.label}</p>
                            <p className="text-xs text-zinc-400 truncate">
                              <code className="font-mono">{b.apiName}</code>
                              {obj && !obj.nav_enabled && (
                                <span className="ml-2 px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">非表示</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {obj ? (
                          <Link
                            href={`/admin/books/${obj.id}`}
                            className="shrink-0 text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            フィールド管理 →
                          </Link>
                        ) : (
                          <span className="shrink-0 text-xs text-zinc-300">フィールド定義なし</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}

        {/* ── カスタムブック（どのモジュールにも属さない） ── */}
        <section className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
            <span className="font-semibold text-zinc-900">カスタムブック</span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium bg-violet-100 text-violet-700">カスタム</span>
          </div>
          {customBooks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-zinc-400 text-center">カスタムブックはまだありません（右上の「＋ 新規ブック」から作成）</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {customBooks.map((obj) => (
                <div key={obj.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <NavIcon icon={obj.icon} className="w-4.5 h-4.5 text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 text-sm truncate">{obj.label_plural}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        <code className="font-mono">{obj.api_name}</code>
                        {obj.is_builtin && (
                          <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-xs">組み込み</span>
                        )}
                        {!obj.nav_enabled && (
                          <span className="ml-2 px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs">非表示</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/admin/books/${obj.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      フィールド管理 →
                    </Link>
                    {!obj.is_builtin && <ObjectDeleteButton id={obj.id} label={obj.label_plural} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 商談の商品候補ブック（REQ-0034） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">商談の「商品」候補ブック</h2>
          <p className="text-xs text-zinc-500 mt-1">
            商談詳細の「商品」セクションで紐付け先として選べるブックを設定します。
            チェックしたブックのレコードが商品ピッカーに表示されます（単価フィールドがあれば自動補完）。
          </p>
        </div>
        <form action={saveOpportunityProductBooks} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {productBookCandidates.map((b) => (
              <label key={b.api} className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input type="checkbox" name="books" value={b.api} defaultChecked={productBookSet.has(b.api)} className="accent-blue-600 w-4 h-4" />
                <span className="text-sm text-zinc-800">{b.label}</span>
                <span className="text-[11px] text-zinc-400 font-mono ml-auto">{b.api}</span>
                {!b.builtin && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] bg-violet-100 text-violet-700">カスタム</span>}
              </label>
            ))}
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
        </form>
      </section>

      {/* レコード承認の設定（REQ-0023/0037 / #85：全ブック・複数ルール・ステータス遷移トリガー） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">レコード承認</h2>
          <p className="text-xs text-zinc-500 mt-1">
            ブックごとに承認ルールを設定します。「ステータス遷移」ルールは、対象の遷移（例: 交渉 → 受注）を
            行おうとした時に承認待ちを作成し、承認されると自動でステータスが変わります。
            「手動申請」ルールはレコード詳細の「承認を申請」から起票します。承認待ちの間、対象レコードは編集できません。
          </p>
        </div>
        <ApprovalRulesEditor
          books={approvalBooks}
          configs={approvalConfigs}
          users={approvalAdminData.users}
          roles={approvalAdminData.roles}
        />
      </section>

      {/* ボードの終端列ウィンドウ（REQ-0044） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">ボードの完了レコード表示期間</h2>
          <p className="text-xs text-zinc-500 mt-1">
            商談パイプラインの「受注・失注」、整備ボードの「完了」は溜まり続けるため、
            ボードでは直近の期間だけ表示します（全件はリストビューで確認できます）。
            進行中のレコードは常にすべて表示されます。
          </p>
        </div>
        <form action={saveBoardClosedWindow} className="flex flex-wrap items-center gap-3">
          <select
            name="months"
            defaultValue={mobileNavSettings.board_closed_window_months}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          >
            <option value="1">直近1ヶ月</option>
            <option value="3">直近3ヶ月</option>
            <option value="6">直近6ヶ月</option>
            <option value="12">直近12ヶ月</option>
            <option value="0">無制限（すべて表示）</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
        </form>
      </section>

      {/* モバイル下部タブの設定（REQ-0041） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">モバイル下部タブ</h2>
          <p className="text-xs text-zinc-500 mt-1">
            スマホ画面の下部に表示する4つのタブを選びます（中央のクイック操作ボタンは固定）。
            左側2つ・右側2つの並びで表示されます。
          </p>
        </div>
        <form action={saveMobileBottomNav} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <label key={i} className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-500">
                  {i < 2 ? `左${i + 1}` : `右${i - 1}`}
                </span>
                <select
                  name={`slot_${i + 1}`}
                  defaultValue={bottomNavCurrent[i]}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {bottomNavOptions.map((o) => (
                    <option key={o.href} value={o.href}>{o.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">保存</button>
        </form>
      </section>

      <NavOrderEditor groups={navGroups} userOrder={userOrder} systemOrder={systemOrder} />

      {/* 活動種別の管理（builtin object のピックリスト値） */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2"><NavIcon icon="📋" className="w-4 h-4" /> 活動種別</h2>
          <p className="text-xs text-zinc-500 mt-1">
            活動履歴フォームで選べる種別の一覧。既存の活動レコードに影響する場合があるので、
            value の変更は慎重に。
          </p>
        </div>
        <ActivityTypesEditor initial={activityTypes} />
      </section>
    </div>
  )
}

// deleteObjectDef を bind して Client Component に渡す
async function ObjectDeleteButton({ id, label }: { id: string; label: string }) {
  const action = deleteObjectDef.bind(null, id)
  return (
    <DeleteButton
      action={action}
      confirmMessage={`「${label}」を削除しますか？関連レコードもすべて削除されます。`}
      label="削除"
    />
  )
}
