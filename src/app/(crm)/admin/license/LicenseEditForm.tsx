'use client'

/**
 * ライセンス編集フォーム (Issue #67 Phase 2)
 *
 * 機能フラグ・プラン・ステータス・期限を編集する。
 * 保存時は updateLicense Server Action 経由。
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLicense } from '@/app/actions/license'
import type { License, LicensePlan, LicenseStatus, LicenseFeatures } from '@/lib/license/types'

const PLANS: { value: LicensePlan; label: string; description: string }[] = [
  { value: 'starter',       label: 'スタータープラン',     description: '1業種 / 1〜5 user / ¥8,000 + ¥3,500/user' },
  { value: 'standard',      label: 'スタンダードプラン',   description: '〜30 user / 優先サポート' },
  { value: 'pro',           label: 'プロプラン',           description: '〜100 user / カスタム帳票' },
  { value: 'early_adopter', label: 'アーリーアダプター',   description: '初期 10 社限定 / 1 年固定価格' },
  { value: 'enterprise',    label: 'エンタープライズ',     description: 'SSO/SAML/SCIM 対応' },
]

const STATUSES: { value: LicenseStatus; label: string; color: string }[] = [
  { value: 'active',    label: 'アクティブ (通常利用)',   color: 'bg-green-100 text-green-800' },
  { value: 'trial',     label: 'トライアル',              color: 'bg-blue-100 text-blue-800' },
  { value: 'expired',   label: '期限切れ',                color: 'bg-orange-100 text-orange-800' },
  { value: 'suspended', label: '停止中',                  color: 'bg-rose-100 text-rose-800' },
]

const INDUSTRIES = [
  { value: '',             label: '— (未設定) —' },
  { value: 'auto-body',    label: '🔧 auto-body (板金・整備)' },
  { value: 'real-estate',  label: '🏠 real-estate (不動産)' },
  { value: 'staffing',     label: '🧑‍💼 staffing (人材アテンド)' },
]

const FEATURE_DEFS: {
  key: keyof LicenseFeatures;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string-list';
}[] = [
  { key: 'ai_summary',        label: '🤖 AI まとめ機能',        description: '商談・物件の活動を AI が要約 (+¥5,000/月)', type: 'boolean' },
  { key: 'line_integration',  label: '💬 LINE 連携',           description: '受信→活動化、送信 (+¥3,000/月)', type: 'boolean' },
  { key: 'custom_documents',  label: '📄 カスタム帳票',         description: 'プラン以外の独自帳票テンプレ', type: 'boolean' },
  { key: 'extra_industries',  label: '🌐 追加業種',             description: 'メイン業種以外の業種オーバーレイ (カンマ区切り)', type: 'string-list' },
  { key: 'max_users',         label: '👥 ユーザー数上限',        description: '空欄 = 無制限', type: 'number' },
  { key: 'max_storage_mb',    label: '💾 ストレージ上限 (MB)',  description: '空欄 = 無制限', type: 'number' },
]

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function toLocalDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

type EnvOverrides = {
  AI_FEATURE_ENABLED:   'true' | 'false' | 'unset'
  LINE_FEATURE_ENABLED: 'true' | 'false' | 'unset'
}

type Props = {
  initial: License | null
  envOverrides: EnvOverrides
}

export default function LicenseEditForm({ initial, envOverrides }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [plan, setPlan]           = useState<LicensePlan>(initial?.plan ?? 'starter')
  const [status, setStatus]       = useState<LicenseStatus>(initial?.status ?? 'active')
  const [industry, setIndustry]   = useState(initial?.industry_main ?? '')
  const [startsAt, setStartsAt]   = useState(toLocalDateInput(initial?.starts_at))
  const [expiresAt, setExpiresAt] = useState(toLocalDateInput(initial?.expires_at))
  const [notes, setNotes]         = useState(initial?.notes ?? '')

  const [features, setFeatures] = useState<LicenseFeatures>(initial?.features ?? {})

  function setFeature<K extends keyof LicenseFeatures>(key: K, value: LicenseFeatures[K]) {
    setFeatures((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const r = await updateLicense({
        plan,
        status,
        industry_main: industry || null,
        features,
        starts_at:  startsAt  || null,
        expires_at: expiresAt || null,
        notes,
      })
      if (r.ok) {
        setMessage({ type: 'success', text: '保存しました' })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: r.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className={`rounded-md p-3 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
                                     : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 現在の env override 状態 */}
      <section className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-2">現在の env override</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <EnvStatus name="AI_FEATURE_ENABLED" value={envOverrides.AI_FEATURE_ENABLED} />
          <EnvStatus name="LINE_FEATURE_ENABLED" value={envOverrides.LINE_FEATURE_ENABLED} />
        </div>
      </section>

      {/* プラン・ステータス */}
      <section className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">契約情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">プラン</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as LicensePlan)} className={`${FIELD_CLS} bg-white`}>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-400 mt-1">
              {PLANS.find((p) => p.value === plan)?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">ステータス</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as LicenseStatus)} className={`${FIELD_CLS} bg-white`}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">メイン業種</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={`${FIELD_CLS} bg-white`}>
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">開始日</label>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={FIELD_CLS} />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">有効期限</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={FIELD_CLS} />
            <p className="text-[10px] text-zinc-400 mt-1">空欄 = 無期限</p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">メモ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="契約書番号、特記事項など"
              className={`${FIELD_CLS} resize-y`} />
          </div>
        </div>
      </section>

      {/* 機能フラグ */}
      <section className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">機能フラグ</h2>
        <div className="space-y-4">
          {FEATURE_DEFS.map((def) => (
            <FeatureRow
              key={def.key}
              def={def}
              value={features[def.key]}
              onChange={(v) => setFeature(def.key, v as LicenseFeatures[typeof def.key])}
            />
          ))}
        </div>
      </section>

      {/* 保存 */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
        >
          {pending ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}

function EnvStatus({ name, value }: { name: string; value: 'true' | 'false' | 'unset' }) {
  const label = value === 'unset' ? '未設定 (DB を使用)'
              : value === 'true'  ? '強制的に有効'
              :                     '強制的に無効'
  const cls = value === 'unset' ? 'bg-zinc-100 text-zinc-700'
            : value === 'true'  ? 'bg-green-100 text-green-800'
            :                     'bg-rose-100 text-rose-800'
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs text-zinc-600">{name}</code>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
    </div>
  )
}

function FeatureRow({
  def, value, onChange,
}: {
  def: typeof FEATURE_DEFS[number]
  value: LicenseFeatures[keyof LicenseFeatures] | undefined
  onChange: (v: LicenseFeatures[keyof LicenseFeatures]) => void
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-b-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800">{def.label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{def.description}</p>
      </div>
      <div className="shrink-0">
        {def.type === 'boolean' && (
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 accent-blue-600 cursor-pointer"
            />
          </label>
        )}
        {def.type === 'number' && (
          <input
            type="number"
            min="0"
            value={value as number | undefined ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            className={`${FIELD_CLS} w-28`}
            placeholder="無制限"
          />
        )}
        {def.type === 'string-list' && (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => {
              const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              onChange(arr)
            }}
            placeholder="real-estate, staffing"
            className={`${FIELD_CLS} w-48`}
          />
        )}
      </div>
    </div>
  )
}
