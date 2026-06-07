import { MODULE_REGISTRY, getEnabledModules } from '@/lib/modules/registry'
import type { ModuleCategory } from '@/lib/modules/types'

// ライセンス/業種を実行時に読むため動的レンダリング
export const dynamic = 'force-dynamic'

/**
 * モジュール構成ビュー（#10/#11 の読み取り専用ビュー）
 *
 * 「モジュール > ブック」の構造と、現在の有効/無効状態を可視化する。
 * ※ Preview 確認用。トグル操作（/admin/modules の編集）と admin ゲートは #11 で追加する。
 */
const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  platform: '基盤',
  crm: 'CRM',
  erp: 'ERP',
  industry: '業種',
}
const CATEGORY_ORDER: ModuleCategory[] = ['platform', 'crm', 'erp', 'industry']
const CATEGORY_COLOR: Record<ModuleCategory, string> = {
  platform: 'bg-zinc-100 text-zinc-700',
  crm: 'bg-blue-100 text-blue-700',
  erp: 'bg-emerald-100 text-emerald-700',
  industry: 'bg-amber-100 text-amber-700',
}

export default async function ModulesAdminPage() {
  const enabled = await getEnabledModules()
  const enabledIds = new Set(enabled.map((m) => m.id))
  const all = Object.values(MODULE_REGISTRY)
    .slice()
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name, 'ja'),
    )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">モジュール構成</h1>
        <p className="mt-1 text-sm text-zinc-500">
          「モジュール ＞ ブック」の構造と現在の有効状態。<span className="font-medium">{enabled.length}</span> /{' '}
          {all.length} モジュールが有効です。
          <br />
          <span className="text-xs text-zinc-400">
            ※ 読み取り専用ビュー（Preview 確認用）。トグル操作・権限ゲートは #11 で追加予定。
          </span>
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((m) => {
          const on = enabledIds.has(m.id)
          return (
            <div
              key={m.id}
              className={`rounded-xl border p-4 transition-colors ${
                on ? 'border-blue-200 bg-white' : 'border-zinc-200 bg-zinc-50 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 truncate">{m.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLOR[m.category]}`}>
                      {CATEGORY_LABEL[m.category]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400 font-mono">{m.id}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    on ? 'bg-green-100 text-green-700' : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  {on ? '有効' : '無効'}
                </span>
              </div>

              {m.dependsOn && m.dependsOn.length > 0 && (
                <div className="mt-2 text-xs text-zinc-500">
                  依存: {m.dependsOn.join(', ')}
                </div>
              )}

              {m.books && m.books.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-1">ブック</div>
                  <ul className="flex flex-wrap gap-1.5">
                    {m.books.map((b) => (
                      <li
                        key={b.apiName}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                        title={b.apiName}
                      >
                        {b.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
