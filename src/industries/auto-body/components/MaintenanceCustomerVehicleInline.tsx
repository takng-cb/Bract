'use client'

/**
 * 整備詳細の顧客／車両セクション用「検索→なければ新規」インラインエディタ（REQ-0042）。
 *
 * - 各セクションに入力欄が常時表示されるのがデフォルト（編集トグル無し）。
 * - 入力すると候補がデバウンス検索で出る。候補を選べば既存レコードに紐付け、
 *   候補に無いテキストのままなら保存時に新規レコードを作成して紐付ける。
 * - 顧客: 取引先（検索 or 新規）＋顧客担当者＋請求先別指定
 * - 車両: 顧客車両（検索 or 新規。新規時はナンバー＋車名を入力）
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { updateMaintenanceCustomerVehicle } from '@/industries/auto-body/actions/maintenance'
import {
  inlineCreateAccount, inlineCreateCustomerVehicle,
  findAccountCandidates, findCustomerVehicleCandidates,
  type VehicleCandidate,
} from '@/industries/auto-body/actions/maintenanceInline'

export type LinkInitial = {
  customer_vehicle_id: string | null
  account_id:          string | null
  contact_id:          string | null
  billing_account_id:  string | null
}

type Candidate = { id: string; name: string }

/** デバウンス付きの検索コンボボックス（選択済みはチップ表示） */
function SearchCombo({
  placeholder, selectedLabel, onClear, value, onChange, candidates, searching, onPick, createHint,
}: {
  placeholder: string
  selectedLabel: string | null
  onClear: () => void
  value: string
  onChange: (v: string) => void
  candidates: { id: string; label: string }[]
  searching: boolean
  onPick: (id: string, label: string) => void
  /** 候補に完全一致が無いとき表示する新規作成ヒント */
  createHint?: string
}) {
  const [focused, setFocused] = useState(false)
  if (selectedLabel) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-sm text-brand-800">
        <span className="truncate">{selectedLabel}</span>
        <button type="button" onClick={onClear} aria-label="選択を解除" className="shrink-0 text-brand-400 hover:text-brand-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    )
  }
  const showList = focused && value.trim().length > 0
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 px-2.5 py-1.5 focus-within:border-brand-400">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full text-sm outline-none"
        />
        {searching && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-zinc-300" aria-hidden />}
      </div>
      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(c.id, c.label) }}
              className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            >
              {c.label}
            </button>
          ))}
          {createHint && (
            <p className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-700">
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />{createHint}
            </p>
          )}
          {candidates.length === 0 && !createHint && (
            <p className="px-3 py-1.5 text-xs text-zinc-400">{searching ? '検索中…' : '候補がありません'}</p>
          )}
        </div>
      )}
    </div>
  )
}

function useDebouncedSearch<T>(query: string, search: (q: string) => Promise<T[]>): { results: T[]; searching: boolean } {
  const [results, setResults] = useState<T[]>([])
  const [searching, startTransition] = useTransition()
  const reqId = useRef(0)
  useEffect(() => {
    const myId = ++reqId.current
    const q = query.trim()
    const t = setTimeout(() => {
      if (reqId.current !== myId) return
      if (q.length < 1) { setResults([]); return }
      startTransition(async () => {
        const res = await search(q)
        if (reqId.current === myId) setResults(res)
      })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return { results, searching }
}

// ────────────────────────────────────────────────────────────────
// 顧客セクション
// ────────────────────────────────────────────────────────────────
export function CustomerInlineEditor({
  maintenanceId, initial, currentAccountName, accounts, contacts,
}: {
  maintenanceId: string
  initial: LinkInitial
  /** 現在紐付いている取引先名（チップ初期表示用） */
  currentAccountName: string | null
  accounts: { id: string; name: string }[]
  contacts: { id: string; full_name: string; account_id: string | null }[]
}) {
  const [accountId, setAccountId] = useState(initial.account_id ?? '')
  const [accountLabel, setAccountLabel] = useState<string | null>(initial.account_id ? currentAccountName : null)
  const [accountText, setAccountText] = useState('')
  const [contactId, setContactId] = useState(initial.contact_id ?? '')
  const [billingAccountId, setBillingAccountId] = useState(initial.billing_account_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const { results: candidates, searching } = useDebouncedSearch<Candidate>(accountText, findAccountCandidates)

  const filteredContacts = accountId
    ? contacts.filter((c) => c.account_id === accountId)
    : contacts.filter((c) => !c.account_id)

  const willCreate = !accountId && accountText.trim().length > 0
  const dirty =
    accountId !== (initial.account_id ?? '') ||
    willCreate ||
    contactId !== (initial.contact_id ?? '') ||
    billingAccountId !== (initial.billing_account_id ?? '')

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        let finalAccountId: string | null = accountId || null
        if (willCreate) {
          const created = await inlineCreateAccount({ name: accountText.trim() })
          finalAccountId = created.id
        }
        if (!finalAccountId && !contactId) throw new Error('顧客（取引先または人物）は必須です')
        if (!initial.customer_vehicle_id) throw new Error('先に車両セクションで顧客車両を設定してください')
        await updateMaintenanceCustomerVehicle(maintenanceId, {
          customer_vehicle_id: initial.customer_vehicle_id,
          account_id:          finalAccountId,
          contact_id:          contactId || null,
          billing_account_id:  billingAccountId || null,
        })
        setAccountText('')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">取引先（入力で検索・無ければ新規作成）</label>
        <SearchCombo
          placeholder="会社名を入力（空のまま＝個人のお客様）"
          selectedLabel={accountLabel}
          onClear={() => { setAccountId(''); setAccountLabel(null); setContactId('') }}
          value={accountText}
          onChange={setAccountText}
          candidates={candidates.map((c) => ({ id: c.id, label: c.name }))}
          searching={searching}
          onPick={(id, label) => { setAccountId(id); setAccountLabel(label); setAccountText(''); setContactId('') }}
          createHint={
            accountText.trim() && !candidates.some((c) => c.name === accountText.trim())
              ? `保存時に「${accountText.trim()}」を新規取引先として登録します`
              : undefined
          }
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">{accountId ? '顧客担当者' : '顧客（人物・BtoC）'}</label>
        <SearchableSelect
          key={`contact-${accountId}-${contactId}`}
          name="contact_id"
          defaultValue={contactId || undefined}
          options={filteredContacts.map((c) => ({ value: c.id, label: c.full_name }))}
          placeholder="—"
          onSelect={setContactId}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">請求先別指定（保険会社など）</label>
        <SearchableSelect
          key={`billing-${billingAccountId}`}
          name="billing_account_id"
          defaultValue={billingAccountId || undefined}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="—（顧客と同じ）"
          onSelect={setBillingAccountId}
        />
      </div>

      {dirty && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? '保存中…' : willCreate ? '新規登録して保存' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 車両セクション
// ────────────────────────────────────────────────────────────────
export function VehicleInlineEditor({
  maintenanceId, initial, currentVehicleLabel,
}: {
  maintenanceId: string
  initial: LinkInitial
  currentVehicleLabel: string | null
}) {
  const [vehicleId, setVehicleId] = useState(initial.customer_vehicle_id ?? '')
  const [vehicleLabel, setVehicleLabel] = useState<string | null>(initial.customer_vehicle_id ? currentVehicleLabel : null)
  const [picked, setPicked] = useState<VehicleCandidate | null>(null)
  const [text, setText] = useState('')
  const [newCarName, setNewCarName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const { results: candidates, searching } = useDebouncedSearch<VehicleCandidate>(text, findCustomerVehicleCandidates)

  const willCreate = !vehicleId && text.trim().length > 0
  const dirty = vehicleId !== (initial.customer_vehicle_id ?? '') || willCreate

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        let finalVehicleId = vehicleId
        let accountId = initial.account_id
        let contactId = initial.contact_id
        if (willCreate) {
          if (!accountId && !contactId) throw new Error('新規車両の登録には先に顧客の設定が必要です')
          const created = await inlineCreateCustomerVehicle({
            plate_number: text.trim(),
            car_name:     newCarName.trim() || undefined,
            account_id:   accountId ?? undefined,
            contact_id:   contactId ?? undefined,
          })
          finalVehicleId = created.id
        } else if (picked) {
          // 既存車両を選択：整備に顧客が未設定なら車両の所有者を自動補完
          if (!accountId && !contactId) {
            accountId = picked.account_id
            contactId = picked.contact_id
          }
        }
        if (!finalVehicleId) throw new Error('顧客車両を選択または入力してください')
        if (!accountId && !contactId) throw new Error('顧客（取引先または人物）は必須です。先に顧客セクションを設定してください')
        await updateMaintenanceCustomerVehicle(maintenanceId, {
          customer_vehicle_id: finalVehicleId,
          account_id:          accountId,
          contact_id:          contactId,
          billing_account_id:  initial.billing_account_id,
        })
        setText(''); setNewCarName(''); setPicked(null)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">顧客車両（ナンバー / 車名で検索・無ければ新規作成）</label>
        <SearchCombo
          placeholder="例: 35-89、ノート"
          selectedLabel={vehicleLabel}
          onClear={() => { setVehicleId(''); setVehicleLabel(null); setPicked(null) }}
          value={text}
          onChange={setText}
          candidates={candidates.map((c) => ({ id: c.id, label: c.label }))}
          searching={searching}
          onPick={(id, label) => {
            setVehicleId(id); setVehicleLabel(label); setText('')
            setPicked(candidates.find((c) => c.id === id) ?? null)
          }}
          createHint={
            text.trim() && !candidates.some((c) => c.label.includes(text.trim()))
              ? `保存時に「${text.trim()}」をナンバーとして新規車両を登録します`
              : undefined
          }
        />
      </div>

      {willCreate && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">車名（新規登録用・任意）</label>
          <input
            value={newCarName}
            onChange={(e) => setNewCarName(e.target.value)}
            placeholder="例: 日産 ノート"
            className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      )}

      {dirty && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? '保存中…' : willCreate ? '新規登録して保存' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}
