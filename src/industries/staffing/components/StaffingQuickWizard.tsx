'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  parseQuickText,
  applyQuickDraft,
  type StaffingDraft,
  type ClientChoice,
} from '@/industries/staffing/actions/quickRegister'

/**
 * 人材手配 クイック登録ウィザード（②AI / draft-then-apply / REQ-0017）
 * ① 取引先（既存/新規）を指定 → ② 文面貼付 → [AIで解析] → ③ 確認（全項目）→ [起票] → 完了表示
 */
export default function StaffingQuickWizard({ clientAccounts }: { clientAccounts: { id: string; name: string }[] }) {
  // ① 取引先
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(clientAccounts.length > 0 ? 'existing' : 'new')
  const [clientId, setClientId] = useState('')
  const [newClient, setNewClient] = useState({ name: '', contact_person: '', phone: '', line_type: '' })

  // ② 文面・解析
  const [rawText, setRawText] = useState('')
  const [draft, setDraft] = useState<StaffingDraft | null>(null)
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const clientValid = clientMode === 'existing' ? !!clientId : !!newClient.name.trim()

  const onParse = async () => {
    setError(null); setParsing(true)
    try {
      setDraft(await parseQuickText(rawText))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setParsing(false)
    }
  }

  const onApply = async () => {
    if (!draft || !clientValid) return
    setError(null); setApplying(true)
    try {
      const client: ClientChoice =
        clientMode === 'existing'
          ? { mode: 'existing', clientId }
          : { mode: 'new', newClient: { name: newClient.name.trim(), contact_person: newClient.contact_person || null, phone: newClient.phone || null, line_type: newClient.line_type || null } }
      const id = await applyQuickDraft(client, draft, rawText)
      setCreatedId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const resetAll = () => {
    setCreatedId(null); setDraft(null); setRawText(''); setError(null)
    setClientId(''); setNewClient({ name: '', contact_person: '', phone: '', line_type: '' })
  }

  const upd = (patch: Partial<StaffingDraft>) => setDraft((p) => (p ? { ...p, ...patch } : p))

  // 起票完了
  if (createdId) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <p className="text-base font-semibold text-green-800">✅ 案件を起票しました</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/assignments/${createdId}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">案件を開く</Link>
          <Link href={`/assignments/${createdId}/edit`} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">編集する</Link>
          <button onClick={resetAll} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">続けて登録</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ① 取引先 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-semibold text-zinc-700 mb-2">① 取引先</p>
        <div className="flex gap-4 mb-3 text-sm">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={clientMode === 'existing'} onChange={() => setClientMode('existing')} /> 既存から選ぶ
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={clientMode === 'new'} onChange={() => setClientMode('new')} /> 新規で登録
          </label>
        </div>

        {clientMode === 'existing' ? (
          clientAccounts.length > 0 ? (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">取引先を選択…</option>
              {clientAccounts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-zinc-500">登録済みの取引先がありません。「新規で登録」を選んでください。</p>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="取引先名（必須）" required value={newClient.name} onChange={(v) => setNewClient((p) => ({ ...p, name: v }))} />
            <Field label="担当者" value={newClient.contact_person} onChange={(v) => setNewClient((p) => ({ ...p, contact_person: v }))} />
            <Field label="電話" value={newClient.phone} onChange={(v) => setNewClient((p) => ({ ...p, phone: v }))} />
            <label className="block">
              <span className="block text-xs text-zinc-500 mb-1">LINE種別</span>
              <select value={newClient.line_type} onChange={(e) => setNewClient((p) => ({ ...p, line_type: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option value="individual">個人</option>
                <option value="official">公式</option>
              </select>
            </label>
          </div>
        )}
        {!clientValid && (
          <p className="mt-2 text-xs text-amber-600">
            {clientMode === 'existing' ? '取引先を選択してください。' : '取引先名（必須）を入力してください。'}
          </p>
        )}
      </section>

      {/* ② 文面 → 解析 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-semibold text-zinc-700 mb-2">② 依頼文を貼り付け → AIで解析</p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder="例）明日10時から梅田で接客スタッフ2名、日当2万でお願いできますか？"
          className="w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-blue-400 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onParse}
            disabled={parsing || !rawText.trim() || !clientValid}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            title={!clientValid ? '先に取引先を指定してください' : undefined}
          >
            {parsing ? '解析中…' : '✨ AIで解析'}
          </button>
          <span className="text-xs text-zinc-400">※ 解析結果は確認・編集してから起票します（自動反映しません）</span>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
      )}

      {/* ③ 確認（全項目・未記載も編集可） */}
      {draft && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-700">③ 確認・編集（未記載の項目も入力できます）</p>
          {draft.ambiguities && draft.ambiguities.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              要確認: {draft.ambiguities.join(' / ')}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="募集内容/職種" value={draft.role ?? ''} onChange={(v) => upd({ role: v })} />
            <Field label="実施日 (YYYY-MM-DD)" value={draft.work_date ?? ''} onChange={(v) => upd({ work_date: v })} />
            <Field label="人数" value={draft.headcount != null ? String(draft.headcount) : ''} onChange={(v) => upd({ headcount: v ? Number(v) : null })} />
            <Field label="開始 (HH:MM)" value={draft.start_time ?? ''} onChange={(v) => upd({ start_time: v })} />
            <Field label="終了 (HH:MM)" value={draft.end_time ?? ''} onChange={(v) => upd({ end_time: v })} />
            <Field label="場所" value={draft.location ?? ''} onChange={(v) => upd({ location: v })} />
            <Field label="発注単価（円）" value={draft.client_rate != null ? String(draft.client_rate) : ''} onChange={(v) => upd({ client_rate: v ? Number(v) : null })} />
          </div>
          <label className="block">
            <span className="block text-xs text-zinc-500 mb-1">説明 / 備考</span>
            <textarea
              value={draft.note ?? ''}
              onChange={(e) => upd({ note: e.target.value })}
              rows={3}
              placeholder="（未記載）補足・特記事項など"
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onApply}
              disabled={applying || !clientValid}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {applying ? '起票中…' : 'この内容で案件を起票'}
            </button>
            <span className="text-xs text-zinc-400">タイトルは「取引先名＋日付＋内容」で自動生成されます</span>
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none ${
          required && !value.trim() ? 'border-amber-300 focus:border-amber-400' : 'border-zinc-300 focus:border-blue-400'
        }`}
      />
    </label>
  )
}
