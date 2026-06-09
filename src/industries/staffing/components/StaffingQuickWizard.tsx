'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import {
  parseQuickText,
  applyQuickDraft,
  listContactsForAccount,
  findClientAccountsByName,
  type StaffingDraft,
  type ClientChoice,
  type ContactChoice,
} from '@/industries/staffing/actions/quickRegister'

/**
 * 人材手配 クイック登録ウィザード（②AI / draft-then-apply / REQ-0017）
 * ① 取引先（既存/新規）+ 担当者（既存/新規/なし）を指定 → ② 文面貼付 → [AIで解析]
 *   → ③ 確認（全項目）→ [起票] → 完了表示
 *
 * 取引先の重複登録を防ぐ：既存取引先は select で選び（新規作成しない）、
 * 「既存取引先 ＋ はじめての担当者」も担当者だけ新規追加できる。
 */
export default function StaffingQuickWizard({ clientAccounts }: { clientAccounts: { id: string; name: string }[] }) {
  // ① 取引先
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(clientAccounts.length > 0 ? 'existing' : 'new')
  const [clientId, setClientId] = useState('')
  const [newClient, setNewClient] = useState({ name: '', phone: '', line_type: '' })

  // ①-b 担当者(人物)
  const [contactMode, setContactMode] = useState<'none' | 'existing' | 'new'>('none')
  const [contactId, setContactId] = useState('')
  const [newContact, setNewContact] = useState({ name: '', phone: '' })
  const [existingContacts, setExistingContacts] = useState<{ id: string; full_name: string }[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)

  // ② 文面・解析
  const [rawText, setRawText] = useState('')
  const [draft, setDraft] = useState<StaffingDraft | null>(null)
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [checkingDup, setCheckingDup] = useState(false)
  const [dupCandidates, setDupCandidates] = useState<{ id: string; name: string }[]>([])
  const [contactDupCandidates, setContactDupCandidates] = useState<{ id: string; full_name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const clientValid = clientMode === 'existing' ? !!clientId : !!newClient.name.trim()
  const contactValid = contactMode === 'new' ? !!newContact.name.trim() : contactMode === 'existing' ? !!contactId : true
  const canProceed = clientValid && contactValid

  // 既存取引先を選んだら、その取引先の担当者一覧を取得（既存担当者を選べるように）
  const onSelectClient = async (id: string) => {
    setClientId(id)
    setContactMode('none'); setContactId(''); setExistingContacts([])
    if (!id) return
    setLoadingContacts(true)
    try {
      setExistingContacts(await listContactsForAccount(id))
    } catch {
      setExistingContacts([])
    } finally {
      setLoadingContacts(false)
    }
  }

  const switchClientMode = (m: 'existing' | 'new') => {
    setClientMode(m)
    setContactMode('none'); setContactId(''); setNewContact({ name: '', phone: '' }); setExistingContacts([])
    setDupCandidates([]); setContactDupCandidates([])
  }

  const buildContactChoice = (allowDuplicate = false): ContactChoice => {
    if (contactMode === 'existing') return { mode: 'existing', contactId }
    if (contactMode === 'new') return { mode: 'new', name: newContact.name.trim(), phone: newContact.phone || null, allowDuplicate }
    return { mode: 'none' }
  }

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

  const runApply = async (opts: { allowDupClient?: boolean; allowDupContact?: boolean } = {}) => {
    if (!draft || !canProceed) return
    setError(null); setDupCandidates([]); setContactDupCandidates([]); setApplying(true)
    try {
      const contact = buildContactChoice(opts.allowDupContact ?? false)
      const client: ClientChoice =
        clientMode === 'existing'
          ? { mode: 'existing', clientId, contact }
          : { mode: 'new', newClient: { name: newClient.name.trim(), phone: newClient.phone || null, line_type: newClient.line_type || null, allowDuplicate: opts.allowDupClient ?? false }, contact }
      const id = await applyQuickDraft(client, draft, rawText)
      setCreatedId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const onApply = async () => {
    if (!draft || !canProceed) return
    // 新規取引先は起票前に同名重複を確認し、あれば確認画面を出す（即エラーにしない）
    if (clientMode === 'new') {
      setError(null); setCheckingDup(true)
      try {
        const matches = await findClientAccountsByName(newClient.name.trim())
        if (matches.length > 0) { setDupCandidates(matches); return }
      } catch {
        // 確認に失敗しても apply 側で再防御するためそのまま続行
      } finally {
        setCheckingDup(false)
      }
    }
    // 既存取引先＋新規担当者は、同じ取引先内の同名担当者を確認（取得済みの一覧で判定）
    if (clientMode === 'existing' && contactMode === 'new') {
      const q = newContact.name.trim().toLowerCase()
      const matches = existingContacts.filter((c) => c.full_name.trim().toLowerCase() === q)
      if (matches.length > 0) { setError(null); setContactDupCandidates(matches); return }
    }
    await runApply()
  }

  // 確認画面で「既存の取引先を使う」を選んだ：既存モードに切替えてその取引先の担当者を読み込む
  const onUseExistingFromDup = async (c: { id: string; name: string }) => {
    setDupCandidates([])
    setClientMode('existing')
    await onSelectClient(c.id)
  }

  // 確認画面で「既存の担当者を使う」を選んだ：その担当者を選択状態にする
  const onUseExistingContact = (c: { id: string; full_name: string }) => {
    setContactDupCandidates([])
    setContactMode('existing')
    setContactId(c.id)
  }

  const resetAll = () => {
    setCreatedId(null); setDraft(null); setRawText(''); setError(null); setDupCandidates([]); setContactDupCandidates([])
    setClientId(''); setNewClient({ name: '', phone: '', line_type: '' })
    setContactMode('none'); setContactId(''); setNewContact({ name: '', phone: '' }); setExistingContacts([])
  }

  const upd = (patch: Partial<StaffingDraft>) => setDraft((p) => (p ? { ...p, ...patch } : p))

  // 起票完了
  if (createdId) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <p className="text-base font-semibold text-green-800 flex items-center gap-2"><NavIcon icon="✅" className="w-4 h-4" />案件を起票しました</p>
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
            <input type="radio" checked={clientMode === 'existing'} onChange={() => switchClientMode('existing')} /> 既存から選ぶ
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={clientMode === 'new'} onChange={() => switchClientMode('new')} /> 新規で登録
          </label>
        </div>

        {clientMode === 'existing' ? (
          clientAccounts.length > 0 ? (
            <select
              value={clientId}
              onChange={(e) => onSelectClient(e.target.value)}
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

        {/* ①-b 担当者(人物) */}
        {clientValid && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-xs font-semibold text-zinc-600 mb-2">担当者（任意・人物として記録）</p>
            <div className="flex flex-wrap gap-4 mb-2 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" checked={contactMode === 'none'} onChange={() => setContactMode('none')} /> 指定しない
              </label>
              {clientMode === 'existing' && existingContacts.length > 0 && (
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={contactMode === 'existing'} onChange={() => setContactMode('existing')} /> 既存の担当者から選ぶ
                </label>
              )}
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" checked={contactMode === 'new'} onChange={() => setContactMode('new')} /> 新しい担当者を登録
              </label>
            </div>

            {loadingContacts && <p className="text-xs text-zinc-400">担当者を読み込み中…</p>}

            {contactMode === 'existing' && (
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">担当者を選択…</option>
                {existingContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            )}

            {contactMode === 'new' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="担当者名（必須）" required value={newContact.name} onChange={(v) => setNewContact((p) => ({ ...p, name: v }))} />
                <Field label="電話" value={newContact.phone} onChange={(v) => setNewContact((p) => ({ ...p, phone: v }))} />
              </div>
            )}
            {contactMode === 'existing' && existingContacts.length === 0 && !loadingContacts && (
              <p className="text-xs text-zinc-400">この取引先にはまだ担当者がいません。「新しい担当者を登録」を選んでください。</p>
            )}
            {!contactValid && (
              <p className="mt-2 text-xs text-amber-600">
                {contactMode === 'new' ? '担当者名（必須）を入力してください。' : '担当者を選択してください。'}
              </p>
            )}
          </div>
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
            disabled={parsing || !rawText.trim() || !canProceed}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            title={!canProceed ? '先に取引先・担当者を指定してください' : undefined}
          >
            {parsing ? '解析中…' : <><Sparkles className="w-4 h-4 inline -mt-0.5" strokeWidth={2.25} /> AIで解析</>}
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
          {dupCandidates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-800">同名の取引先が見つかりました</p>
              <p className="text-xs text-amber-700">
                「{newClient.name.trim()}」と同名の取引先が既に登録されています。重複を避けるため、どちらかを選んでください。
              </p>
              <div className="space-y-1.5">
                {dupCandidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onUseExistingFromDup(c)}
                    className="block w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    ✓ 既存の「{c.name}」を使う（担当者をこの後に選べます）
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => runApply({ allowDupClient: true })}
                  disabled={applying}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {applying ? '起票中…' : '別の取引先として新規登録する'}
                </button>
                <button
                  onClick={() => setDupCandidates([])}
                  disabled={applying}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  戻る
                </button>
              </div>
            </div>
          ) : contactDupCandidates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-800">同名の担当者が見つかりました</p>
              <p className="text-xs text-amber-700">
                この取引先に「{newContact.name.trim()}」と同名の担当者が既に登録されています。重複を避けるため、どちらかを選んでください。
              </p>
              <div className="space-y-1.5">
                {contactDupCandidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onUseExistingContact(c)}
                    className="block w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    ✓ 既存の担当者「{c.full_name}」を使う
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => runApply({ allowDupContact: true })}
                  disabled={applying}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {applying ? '起票中…' : '別の担当者として新規登録する'}
                </button>
                <button
                  onClick={() => setContactDupCandidates([])}
                  disabled={applying}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  戻る
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={onApply}
                disabled={applying || checkingDup || !canProceed}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {applying ? '起票中…' : checkingDup ? '確認中…' : 'この内容で案件を起票'}
              </button>
              <span className="text-xs text-zinc-400">タイトルは「取引先名＋日付＋内容」で自動生成されます</span>
            </div>
          )}
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
