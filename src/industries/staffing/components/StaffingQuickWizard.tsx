'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseQuickText, applyQuickDraft, type StaffingDraft } from '@/industries/staffing/actions/quickRegister'

/**
 * 人材手配 クイック登録ウィザード（②AI / draft-then-apply）
 * 貼付 → [AIで解析] → 差分プレビュー（編集可）→ [この内容で起票]
 */
export default function StaffingQuickWizard() {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [draft, setDraft] = useState<StaffingDraft | null>(null)
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onParse = async () => {
    setError(null); setParsing(true)
    try {
      const d = await parseQuickText(rawText)
      setDraft(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setParsing(false)
    }
  }

  const onApply = async () => {
    if (!draft) return
    setError(null); setApplying(true)
    try {
      const id = await applyQuickDraft(draft, rawText)
      router.push(`/assignments/${id}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setApplying(false)
    }
  }

  const upd = (patch: Partial<StaffingDraft>) => setDraft((p) => (p ? { ...p, ...patch } : p))

  return (
    <div className="space-y-5">
      {/* 入力 */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">LINE等の文面を貼り付け</label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder="例）明日10時から梅田で接客スタッフ2名、日当2万でお願いできますか？（○○商事）"
          className="w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-blue-400 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onParse}
            disabled={parsing || !rawText.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {parsing ? '解析中…' : '✨ AIで解析'}
          </button>
          <span className="text-xs text-zinc-400">※ 解析結果は確認・編集してから起票します（自動反映しません）</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* 差分プレビュー（編集可） */}
      {draft && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-700">確認・編集（この内容で案件を起票）</p>

          {draft.ambiguities && draft.ambiguities.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              要確認: {draft.ambiguities.join(' / ')}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="クライアント名" value={draft.client_name ?? ''} onChange={(v) => upd({ client_name: v })} />
            <Field label="募集内容/職種" value={draft.role ?? ''} onChange={(v) => upd({ role: v })} />
            <Field label="実施日 (YYYY-MM-DD)" value={draft.work_date ?? ''} onChange={(v) => upd({ work_date: v })} />
            <Field label="人数" value={draft.headcount != null ? String(draft.headcount) : ''} onChange={(v) => upd({ headcount: v ? Number(v) : null })} />
            <Field label="開始 (HH:MM)" value={draft.start_time ?? ''} onChange={(v) => upd({ start_time: v })} />
            <Field label="終了 (HH:MM)" value={draft.end_time ?? ''} onChange={(v) => upd({ end_time: v })} />
            <Field label="場所" value={draft.location ?? ''} onChange={(v) => upd({ location: v })} />
            <Field label="発注単価（円）" value={draft.client_rate != null ? String(draft.client_rate) : ''} onChange={(v) => upd({ client_rate: v ? Number(v) : null })} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onApply}
              disabled={applying}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {applying ? '起票中…' : 'この内容で案件を起票'}
            </button>
            <span className="text-xs text-zinc-400">起票後、案件編集画面でクライアント（取引先）を確定できます</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
      />
    </label>
  )
}
