import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { MODULE_REGISTRY, isModuleEnabled } from '@/lib/modules/registry'
import { NavIcon } from '@/lib/navIcon'
import PageHeader from '@/components/ui/PageHeader'
import AutoBodyWidgets from '@/components/dashboard/AutoBodyWidgets'
import CrmCoreWidgets from '@/components/dashboard/CrmCoreWidgets'
import SalesWidgets from '@/components/dashboard/SalesWidgets'
import RealEstateWidgets from '@/components/dashboard/RealEstateWidgets'
import StaffingWidgets from '@/components/dashboard/StaffingWidgets'
import InventoryWidgets from '@/components/dashboard/InventoryWidgets'
import { getDashboardWidgetPrefs } from '@/lib/dashboard/userPrefs'
import { getCurrentUserId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * モジュール別ダッシュボード（#22 / REQ-0015）
 * サイドバーのグループ見出しクリックでここに来る。モジュールの起点アクション＋ブック一覧。
 */
export default async function ModuleDashboardPage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  const mod = MODULE_REGISTRY[moduleId]
  if (!mod) notFound()
  if (!(await isModuleEnabled(moduleId))) notFound()

  const headerIcon = mod.navItems?.[0]?.icon
  const widgetPrefs = moduleId === 'auto-body' ? await getDashboardWidgetPrefs(await getCurrentUserId()) : null

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader icon={headerIcon} title={mod.name} description="モジュールのホーム" />

      {/* このモジュールの状況ボード */}
      {moduleId === 'auto-body' && (
        <section className="mb-8">
          <AutoBodyWidgets widgetPrefs={widgetPrefs} />
        </section>
      )}
      {moduleId === 'crm-core' && <CrmCoreWidgets />}
      {moduleId === 'sales' && <SalesWidgets />}
      {moduleId === 'real-estate' && <RealEstateWidgets />}
      {moduleId === 'staffing' && <StaffingWidgets />}
      {moduleId === 'inventory' && <InventoryWidgets />}

      {/* クイック起点 */}
      {mod.quickActions && mod.quickActions.length > 0 && (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold text-zinc-400">クイック起点</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {mod.quickActions.map((a, i) =>
              a.href ? (
                <Link
                  key={i}
                  href={a.href}
                  className="group flex min-h-20 flex-col items-start gap-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                    <NavIcon icon={a.icon} className="h-5 w-5" />
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium leading-tight text-zinc-800">
                    {a.label}
                    {a.kind === 'wizard' && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700"><Sparkles className="h-3 w-3" />AI</span>
                    )}
                  </span>
                </Link>
              ) : (
                <span
                  key={i}
                  title="準備中"
                  className="flex min-h-20 flex-col items-start gap-1.5 rounded-xl border border-dashed border-zinc-200 p-3 text-zinc-400"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-400">
                    <NavIcon icon={a.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-sm leading-tight">{a.label}</span>
                </span>
              ),
            )}
          </div>
        </section>
      )}

      {/* ブック（このモジュールのデータ種別） */}
      {mod.books && mod.books.length > 0 && (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold text-zinc-400">ブック</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {mod.books.map((b) => {
              const nav = mod.navItems?.find((n) => n.label === b.label)
              const href = nav?.href ?? `/objects/${b.apiName}`
              return (
                <Link
                  key={b.apiName}
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                    <NavIcon icon={nav?.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-800">{b.label}</span>
                    <span className="block truncate font-mono text-xs text-zinc-400">{b.apiName}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
