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
 * サイドバーのグループ見出しクリックでここに来る。状況ボード＋クイック操作。
 * （ブック一覧はクイック操作と重複するため非表示。ブックへはサイドバーから遷移する）
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

      {/* クイック操作 */}
      {mod.quickActions && mod.quickActions.length > 0 && (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold text-zinc-400">クイック操作</p>
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

    </div>
  )
}
