'use client'

import { useActionState, useState, useRef } from 'react'
import Link from 'next/link'
import FormFillModal from '@/components/FormFillModal'
import SearchableSelect from '@/components/SearchableSelect'

type Account = { id: string; name: string }
type Contact = { id: string; full_name: string; account_id?: string | null }
type Opportunity = { id: string; name: string }

export type CustomObjectGroup = {
  object_id: string
  api_name: string
  label: string
  label_plural: string
  icon: string
  records: { id: string; label: string }[]
}

type ActivityFormProps = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  accounts: Account[]
  contacts: Contact[]
  opportunities: Opportunity[]
  customGroups?: CustomObjectGroup[]
  defaultValues?: {
    type?: string
    subject?: string
    body?: string | null
    occurred_at?: string
    account_id?: string
    contact_ids?: string[]
    opportunity_id?: string
    custom_object_id?: string
    custom_record_id?: string
  }
}

const TYPES = [
  { value: 'call',    label: '📞 電話' },
  { value: 'email',   label: '✉️ メール' },
  { value: 'meeting', label: '🤝 打合せ' },
  { value: 'note',    label: '📝 メモ' },
]

export default function ActivityForm({ action, cancelHref, accounts, contacts, opportunities, customGroups = [], defaultValues = {} }: ActivityFormProps) {
  const [error, formAction, pending] = useActionState(action, null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(defaultValues.contact_ids ?? [])
  )
  const [selectedAccountId, setSelectedAccountId] = useState(defaultValues.account_id ?? '')
  const [customObjectId, setCustomObjectId] = useState(defaultValues.custom_object_id ?? '')
  const [customRecordId, setCustomRecordId] = useState(defaultValues.custom_record_id ?? '')
  const filteredContacts = selectedAccountId
    ? contacts.filter((c) => c.account_id === selectedAccountId)
    : contacts
  const selectedCustomGroup = customGroups.find((g) => g.object_id === customObjectId)
  const formRef = useRef<HTMLFormElement>(null)

  const now = new Date()
  const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>

      <div className="flex justify-end">
        <FormFillModal
          formRef={formRef}
          csvFormat="種別,件名,内容,日時"
          fieldMap={{ '種別': 'type', '件名': 'subject', '内容': 'body', '日時': 'occurred_at' }}
          valueMap={{
            type: { '電話': 'call', 'メール': 'email', '打合せ': 'meeting', '打ち合わせ': 'meeting', 'メモ': 'note' },
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          種別 <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={(defaultValues.type ?? 'call') === t.value}
                className="accent-blue-600"
              />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          件名 <span className="text-red-500">*</span>
        </label>
        <input
          name="subject"
          defaultValue={defaultValues.subject ?? ''}
          required
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 初回ヒアリング実施"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">内容</label>
        <textarea
          name="body"
          rows={4}
          defaultValue={defaultValues.body ?? ''}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="活動の詳細を記入してください..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">日時</label>
        <input
          name="occurred_at"
          type="datetime-local"
          defaultValue={defaultValues.occurred_at
            ? new Date(new Date(defaultValues.occurred_at).getTime() - new Date(defaultValues.occurred_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            : localDatetime}
          className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">取引先</label>
          <SearchableSelect
            name="account_id"
            defaultValue={defaultValues.account_id}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="選択してください"
            onSelect={(val) => { setSelectedAccountId(val); setSelectedIds(new Set()) }}
          />
        </div>

        {/* 複数人物選択 */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            人物
            {selectedIds.size > 0 && (
              <span className="ml-2 text-xs text-blue-600 font-normal">{selectedIds.size} 名選択中</span>
            )}
          </label>
          {/* 選択済みIDを hidden input で送信 */}
          {Array.from(selectedIds).map((cid) => (
            <input key={cid} type="hidden" name="contact_ids" value={cid} />
          ))}
          {filteredContacts.length === 0 ? (
            <p className="text-sm text-zinc-400">{selectedAccountId ? 'この取引先の人物がいません' : '人物がいません'}</p>
          ) : (
            <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-48 overflow-y-auto">
              {filteredContacts.map((c) => {
                const checked = selectedIds.has(c.id)
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-zinc-50 ${checked ? 'bg-blue-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleContact(c.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-zinc-700">{c.full_name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">商談</label>
          <SearchableSelect
            name="opportunity_id"
            defaultValue={defaultValues.opportunity_id}
            options={opportunities.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="選択してください"
          />
        </div>

        {/* カスタムオブジェクト：取引先・人物・商談以外への関連付け（任意） */}
        {customGroups.length > 0 && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50/60 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">その他の関連先（任意）</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">オブジェクト</label>
                <select
                  value={customObjectId}
                  onChange={(e) => { setCustomObjectId(e.target.value); setCustomRecordId('') }}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— 未選択 —</option>
                  {customGroups.map((g) => (
                    <option key={g.object_id} value={g.object_id}>{g.icon} {g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">レコード</label>
                {/* 値は hidden で送信（SearchableSelect が name を使う） */}
                <input type="hidden" name="custom_record_id" value={customRecordId} />
                {selectedCustomGroup ? (
                  selectedCustomGroup.records.length > 0 ? (
                    <SearchableSelect
                      key={selectedCustomGroup.object_id}
                      name="_custom_record_picker"
                      defaultValue={customRecordId}
                      options={selectedCustomGroup.records.map((r) => ({ value: r.id, label: r.label }))}
                      placeholder="選択してください"
                      onSelect={(v) => setCustomRecordId(v)}
                    />
                  ) : (
                    <p className="text-xs text-zinc-400 py-2">このオブジェクトのレコードがありません</p>
                  )
                ) : (
                  <p className="text-xs text-zinc-400 py-2">先にオブジェクトを選択してください</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {pending ? '保存中...' : '保存'}
        </button>
        <Link href={cancelHref} className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
