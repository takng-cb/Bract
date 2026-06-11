import { getAllObjectDefs, getCustomObjectsForNav } from '@/lib/objectMetadata'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { deleteObjectDef } from '@/app/actions/objectDefinitions'
import DeleteButton from '@/components/DeleteButton'
import NavOrderEditor from '@/components/NavOrderEditor'
import { getNavOrderSettings } from '@/app/actions/navSettings'
import { customObjectsToNavItems, buildExtraNavItems } from '@/lib/navItems'
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
import { saveOpportunityProductBooks } from '@/app/actions/settings'

// ライセンス/モジュール有効状態を実行時に読むため動的レンダリング
export const dynamic = 'force-dynamic'

/**
 * /admin/objects — ブック/モジュール管理（旧: オブジェクト管理 ＋ モジュール構成 #21/#10）
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

  const [objects, { userOrder, systemOrder }, customObjects, activityTypes, enabledModules, lic, productBookCandidates, productBooks] = await Promise.all([
    getAllObjectDefs(),
    getNavOrderSettings(),
    getCustomObjectsForNav(),
    getActivityTypes(),
    getEnabledModules(),
    getLicense(),
    getProductBookCandidates(),
    getOpportunityProductBooks(),
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

  // api_name → object_definitions 行（フィールド管理リンク用）
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

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
      <PageHeader
        icon="🗂️"
        title="ブック/モジュール管理"
        description="モジュールの有効/無効と、各モジュールのブック（データ種別）・フィールド・サイドバー並び順を管理します"
        className="mb-0"
        actions={
          <Link
            href="/admin/objects/new"
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
                            href={`/admin/objects/${obj.id}`}
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
                      href={`/admin/objects/${obj.id}`}
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
