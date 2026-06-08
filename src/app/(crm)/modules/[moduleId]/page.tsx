import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MODULE_REGISTRY, isModuleEnabled } from '@/lib/modules/registry'
import { NavIcon } from '@/lib/navIcon'

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">{mod.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">モジュールダッシュボード</p>
      </header>

      {/* クイック起点 */}
      {mod.quickActions && mod.quickActions.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold text-zinc-400 mb-2">クイック起点</p>
          <div className="flex flex-wrap gap-2">
            {mod.quickActions.map((a, i) =>
              a.href ? (
                <Link
                  key={i}
                  href={a.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <NavIcon icon={a.icon} className="w-4 h-4 shrink-0" />{a.label}
                  {a.kind === 'wizard' && <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">AI</span>}
                </Link>
              ) : (
                <span
                  key={i}
                  title="準備中"
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400"
                >
                  <NavIcon icon={a.icon} className="w-4 h-4 shrink-0" />{a.label}
                </span>
              ),
            )}
          </div>
        </section>
      )}

      {/* ブック（このモジュールのデータ種別） */}
      {mod.books && mod.books.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold text-zinc-400 mb-2">ブック</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {mod.books.map((b) => {
              const nav = mod.navItems?.find((n) => n.label === b.label)
              const href = nav?.href ?? `/objects/${b.apiName}`
              return (
                <Link
                  key={b.apiName}
                  href={href}
                  className="rounded-lg border border-zinc-200 bg-white p-3 hover:border-blue-300 hover:shadow-sm transition-colors"
                >
                  <span className="block text-sm font-medium text-zinc-800">{b.label}</span>
                  <span className="block text-xs text-zinc-400 font-mono">{b.apiName}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
