/**
 * 整備パッケージ（テンプレート）詳細 — 行・諸費用のインライン編集。
 */
import { db } from '@/lib/db'
import { SquarePen } from 'lucide-react'
import {
  maintenance_templates, maintenance_template_lines, maintenance_template_fees,
} from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canEdit } from '@/lib/auth'
import RecordHeader from '@/components/RecordHeader'
import AuthGuard from '@/components/AuthGuard'
import DeleteButton from '@/components/DeleteButton'
import {
  createTemplateLine, updateTemplateLine, deleteTemplateLine,
  createTemplateFee, deleteTemplateFee, deleteTemplate,
} from '@/industries/auto-body/actions/maintenanceTemplates'
import TemplateLineRow from '@/industries/auto-body/components/TemplateLineRow'
import TemplateLineAddForm from '@/industries/auto-body/components/TemplateLineAddForm'
import TemplateFeeAddForm from '@/industries/auto-body/components/TemplateFeeAddForm'
import { AB_ICONS } from '@/industries/auto-body/lib/icons'

function yen(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  return `¥${Math.round(v).toLocaleString()}`
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [t, lines, fees, editable] = await Promise.all([
    db.select().from(maintenance_templates).where(eq(maintenance_templates.id, id)).then((r) => r[0] ?? null),
    db.select().from(maintenance_template_lines)
      .where(eq(maintenance_template_lines.template_id, id))
      .orderBy(asc(maintenance_template_lines.sort_order)),
    db.select().from(maintenance_template_fees)
      .where(eq(maintenance_template_fees.template_id, id))
      .orderBy(asc(maintenance_template_fees.sort_order)),
    canEdit(),
  ])
  if (!t) notFound()

  async function handleDelete() {
    'use server'
    await deleteTemplate(id)
  }
  async function handleCreateLine(formData: FormData) {
    'use server'
    await createTemplateLine(id, formData)
  }
  async function handleCreateFee(formData: FormData) {
    'use server'
    await createTemplateFee(id, formData)
  }

  // 合計集計
  let laborSum = 0, partsSum = 0
  for (const l of lines) {
    const labor = Number(l.labor_amount ?? 0)
    const qty   = Number(l.parts_qty ?? 0)
    const unit  = Number(l.parts_unit_price ?? 0)
    if (Number.isFinite(labor)) laborSum += labor
    if (Number.isFinite(qty) && Number.isFinite(unit)) partsSum += qty * unit
  }
  let taxableFees = 0, nontaxableFees = 0
  for (const f of fees) {
    const a = Number(f.amount ?? 0)
    if (!Number.isFinite(a)) continue
    if (f.category === '課税')   taxableFees += a
    if (f.category === '非課税') nontaxableFees += a
  }
  const subtotal = laborSum + partsSum + taxableFees + nontaxableFees

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <RecordHeader
        crumbs={[
          { label: '整備', href: '/maintenance' },
          { label: '整備パッケージ', href: '/maintenance/templates' },
          { label: t.name },
        ]}
        actions={
          <AuthGuard minRole="editor">
            <div className="flex items-center gap-2">
              <Link href={`/maintenance/templates/${id}/edit`} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm"><SquarePen className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> 編集</Link>
              <DeleteButton action={handleDelete} confirmMessage="このテンプレを削除しますか？" />
            </div>
          </AuthGuard>
        }
      />

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{AB_ICONS.template} {t.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          {t.category && <span className="text-xs px-2 py-0.5 rounded bg-zinc-50 text-zinc-700 border border-zinc-200">{t.category}</span>}
          {t.is_active
            ? <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">有効</span>
            : <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">無効</span>}
        </div>
        {t.description && <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap">{t.description}</p>}
      </div>

      {/* 行アイテム */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">{AB_ICONS.lineItem} 作業項目（{lines.length}）</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">作業項目はまだありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-md divide-y divide-zinc-100">
            {lines.map((l, idx) => (
              <TemplateLineRow
                key={l.id}
                index={idx}
                line={l}
                canEdit={editable}
                updateAction={updateTemplateLine.bind(null, id, l.id)}
                deleteAction={deleteTemplateLine.bind(null, id, l.id)}
              />
            ))}
            <div className="px-4 py-2 bg-zinc-50 text-xs flex justify-between font-semibold">
              <span>作業項目 計（税別）</span>
              <span className="font-mono">{yen(laborSum + partsSum)}</span>
            </div>
          </div>
        )}
        {editable && <TemplateLineAddForm action={handleCreateLine} />}
      </section>

      {/* 諸費用 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">{AB_ICONS.fee} 諸費用（{fees.length}）</h2>
        {fees.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">諸費用はまだありません</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-md divide-y divide-zinc-100">
            {fees.map((f, idx) => (
              <div key={f.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="text-xs text-zinc-400 font-mono w-6 shrink-0">#{idx + 1}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 shrink-0">{f.category}</span>
                <span className="text-zinc-800 flex-1 truncate">{f.item_name}</span>
                <span className="font-mono font-semibold text-zinc-900 shrink-0">{yen(f.amount)}</span>
                {editable && (
                  <form action={async () => { 'use server'; await deleteTemplateFee(id, f.id) }}>
                    <button type="submit" className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50">削除</button>
                  </form>
                )}
              </div>
            ))}
            <div className="px-4 py-2 bg-zinc-50 text-xs flex justify-between font-semibold">
              <span>諸費用 計</span>
              <span className="font-mono">{yen(taxableFees + nontaxableFees)}</span>
            </div>
          </div>
        )}
        {editable && <TemplateFeeAddForm action={handleCreateFee} />}
      </section>

      {/* テンプレ全体合計 */}
      <section className="bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-700">テンプレ全体（参考・税抜）</span>
          <span className="text-xl font-bold font-mono text-zinc-700">{yen(subtotal)}</span>
        </div>
        <p className="text-xs text-blue-600 mt-1">適用時はこの行が現在の整備に追記されます（既存行は残ります）。</p>
      </section>
    </div>
  )
}
