'use client'

/**
 * 整備詳細の顧客／車両セクション用「検索→なければ新規」インラインエディタ（REQ-0042）。
 *
 * - InlineSection の編集フォームとして使う（編集ボタンで開き、保存すると閲覧表示へ戻る）。
 * - 入力すると候補がデバウンス検索で出る。候補を選べば既存レコードに紐付け、
 *   候補に無いテキストのままなら保存時に新規レコードを作成して紐付ける。
 * - 顧客: 取引先（検索 or 新規）＋顧客担当者＋請求先別指定
 * - 車両: 顧客車両（検索 or 新規。新規時はナンバー＋車名を入力）
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SearchCombo, useDebouncedSearch } from './SearchCreateCombo'
import { updateMaintenanceCustomerVehicle } from '@/industries/auto-body/actions/maintenance'
import { useSectionModal } from './SectionEditModal'
import {
  inlineCreateAccount, inlineCreateContact, inlineCreateCustomerVehicle,
  findAccountCandidates, findContactCandidates, findCustomerVehicleCandidates,
  type VehicleCandidate,
} from '@/industries/auto-body/actions/maintenanceInline'

export type LinkInitial = {
  customer_vehicle_id: string | null
  account_id:          string | null
  contact_id:          string | null
  billing_account_id:  string | null
}

type Candidate = { id: string; name: string }

// ────────────────────────────────────────────────────────────────
// 顧客セクション
// ────────────────────────────────────────────────────────────────
export function CustomerInlineEditor({
  maintenanceId, initial, currentAccountName, currentContactName, currentBillingName,
}: {
  maintenanceId: string
  initial: LinkInitial
  /** 現在紐付いている取引先名（チップ初期表示用） */
  currentAccountName: string | null
  currentContactName: string | null
  currentBillingName: string | null
}) {
  const [accountId, setAccountId] = useState(initial.account_id ?? '')
  const [accountLabel, setAccountLabel] = useState<string | null>(initial.account_id ? currentAccountName : null)
  const [accountText, setAccountText] = useState('')
  const [contactId, setContactId] = useState(initial.contact_id ?? '')
  const [contactLabel, setContactLabel] = useState<string | null>(initial.contact_id ? currentContactName : null)
  const [contactText, setContactText] = useState('')
  const [billingId, setBillingId] = useState(initial.billing_account_id ?? '')
  const [billingLabel, setBillingLabel] = useState<string | null>(initial.billing_account_id ? currentBillingName : null)
  const [billingText, setBillingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const modal = useSectionModal()

  const { results: accountCands, searching: accountSearching } =
    useDebouncedSearch<Candidate>(accountText, findAccountCandidates)
  const { results: contactCands, searching: contactSearching } =
    useDebouncedSearch<Candidate>(contactText, (q) => findContactCandidates(q, accountId || null))
  const { results: billingCands, searching: billingSearching } =
    useDebouncedSearch<Candidate>(billingText, findAccountCandidates)

  const willCreateAccount = !accountId && accountText.trim().length > 0
  const willCreateContact = !contactId && contactText.trim().length > 0
  const willCreateBilling = !billingId && billingText.trim().length > 0
  const willCreate = willCreateAccount || willCreateContact || willCreateBilling
  const dirty =
    accountId !== (initial.account_id ?? '') ||
    contactId !== (initial.contact_id ?? '') ||
    billingId !== (initial.billing_account_id ?? '') ||
    willCreate

  const clearAccount = () => {
    setAccountId(''); setAccountLabel(null)
    // 取引先が変わると担当者の前提（所属）も変わるためクリア
    setContactId(''); setContactLabel(null); setContactText('')
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        let finalAccountId: string | null = accountId || null
        if (willCreateAccount) {
          finalAccountId = (await inlineCreateAccount({ name: accountText.trim() })).id
        }
        let finalContactId: string | null = contactId || null
        if (willCreateContact) {
          finalContactId = (await inlineCreateContact({ full_name: contactText.trim(), account_id: finalAccountId })).id
        }
        let finalBillingId: string | null = billingId || null
        if (willCreateBilling) {
          finalBillingId = (await inlineCreateAccount({ name: billingText.trim() })).id
        }
        if (!finalAccountId && !finalContactId) throw new Error('顧客（取引先または人物）は必須です')
        if (!initial.customer_vehicle_id) throw new Error('先に車両セクションで顧客車両を設定してください')
        await updateMaintenanceCustomerVehicle(maintenanceId, {
          customer_vehicle_id: initial.customer_vehicle_id,
          account_id:          finalAccountId,
          contact_id:          finalContactId,
          billing_account_id:  finalBillingId,
        })
        setAccountText(''); setContactText(''); setBillingText('')
        router.refresh()
        modal?.close()  // 保存したら閲覧表示に戻る
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
          onClear={clearAccount}
          value={accountText}
          onChange={setAccountText}
          candidates={accountCands.map((c) => ({ id: c.id, label: c.name }))}
          searching={accountSearching}
          onPick={(id, label) => { setAccountId(id); setAccountLabel(label); setAccountText(''); setContactId(''); setContactLabel(null) }}
          createHint={
            accountText.trim() && !accountCands.some((c) => c.name === accountText.trim())
              ? `保存時に「${accountText.trim()}」を新規取引先として登録します`
              : undefined
          }
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">
          {accountId ? '顧客担当者' : '顧客（人物・BtoC）'}（入力で検索・無ければ新規作成）
        </label>
        <SearchCombo
          placeholder={accountId ? '選択中取引先の人物から検索' : '氏名を入力（個人のお客様）'}
          selectedLabel={contactLabel}
          onClear={() => { setContactId(''); setContactLabel(null) }}
          value={contactText}
          onChange={setContactText}
          candidates={contactCands.map((c) => ({ id: c.id, label: c.name }))}
          searching={contactSearching}
          onPick={(id, label) => { setContactId(id); setContactLabel(label); setContactText('') }}
          createHint={
            contactText.trim() && !contactCands.some((c) => c.name === contactText.trim())
              ? `保存時に「${contactText.trim()}」を新規人物として登録します${accountId ? '（選択中取引先の所属）' : ''}`
              : undefined
          }
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">請求先別指定（保険会社など・入力で検索・無ければ新規作成）</label>
        <SearchCombo
          placeholder="—（顧客と同じ場合は空のまま）"
          selectedLabel={billingLabel}
          onClear={() => { setBillingId(''); setBillingLabel(null) }}
          value={billingText}
          onChange={setBillingText}
          candidates={billingCands.map((c) => ({ id: c.id, label: c.name }))}
          searching={billingSearching}
          onPick={(id, label) => { setBillingId(id); setBillingLabel(label); setBillingText('') }}
          createHint={
            billingText.trim() && !billingCands.some((c) => c.name === billingText.trim())
              ? `保存時に「${billingText.trim()}」を新規取引先として登録します`
              : undefined
          }
        />
      </div>

      <EditorFooter dirty={dirty} pending={pending} willCreate={willCreate} onSave={save} onCancel={() => modal?.close()} />
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
  const modal = useSectionModal()

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
        modal?.close()  // 保存したら閲覧表示に戻る
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

      <EditorFooter dirty={dirty} pending={pending} willCreate={willCreate} onSave={save} onCancel={() => modal?.close()} />
    </div>
  )
}

/** キャンセル / 保存 フッタ（代車フォームと同じ作法） */
function EditorFooter({ dirty, pending, willCreate, onSave, onCancel }: {
  dirty: boolean; pending: boolean; willCreate: boolean
  onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
      <p className="text-xs text-zinc-400">
        {dirty ? <><span className="text-amber-700 font-semibold">●</span> 未保存の変更があります</> : '変更なし'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !dirty}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? '保存中…' : willCreate ? '新規登録して保存' : '保存'}
        </button>
      </div>
    </div>
  )
}
