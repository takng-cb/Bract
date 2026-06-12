'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { FieldDef } from '@/lib/objectMetadata'
import { parseFieldOptions } from '@/lib/fieldUtils'
import FormFillModal from '@/components/FormFillModal'
import SearchableSelect from '@/components/SearchableSelect'
import CreateFeedback from '@/components/CreateFeedback'
import CreateInfoCard from '@/components/create/CreateInfoCard'
import { RecordColumns } from '@/components/record/RecordUI'
import type { CreateState } from '@/lib/duplicateTypes'

type SelectOption = { value: string; label: string }

type Props = {
  fields:          FieldDef[]
  defaultValues?:  Record<string, unknown>
  action:          (prev: unknown, formData: FormData) => Promise<unknown>
  submitLabel?:    string
  cancelHref?:     string
  /** 取引先フィールド用の選択肢（SearchableSelect に渡す） */
  accountOptions?: SelectOption[]
  /** 担当者フィールド用の選択肢（SearchableSelect に渡す） */
  contactOptions?: SelectOption[]
  /** 担当者（ユーザー）フィールド用の選択肢 */
  userOptions?: SelectOption[]
  /** 現在の owner_id デフォルト値 */
  defaultOwnerId?: string | null
  /**
   * レイアウト（REQ-0051）:
   * - 'plain'  … 従来の1カラム縦並び（詳細ページのインライン編集で使用）
   * - 'record' … レコード詳細と同じ RecordColumns + カード構成（新規/編集ページで使用）
   */
  variant?: 'plain' | 'record'
  /** ページヘッダの保存ボタンと紐付ける form id（record バリアント用） */
  formId?: string
}

/** record バリアントのカード入力欄（CreateInfoCard と同じ見た目） */
const CARD_INPUT = 'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 transition-colors'

export default function DynamicForm({
  fields,
  defaultValues = {},
  action,
  submitLabel = '保存',
  cancelHref,
  accountOptions,
  contactOptions,
  userOptions,
  defaultOwnerId,
  variant = 'plain',
  formId = 'record-create-form',
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [state, dispatch, isPending] = useActionState<CreateState, FormData>(
    async (_prev, fd) => {
      try {
        const res = await action(_prev, fd)
        setIsDirty(false)
        // create 経路は CreateState（重複/エラー/null）を返す。edit 経路は void → null。
        return (res ?? null) as CreateState
      } catch (e: unknown) {
        return { kind: 'error', message: (e as Error).message ?? '保存に失敗しました' }
      }
    },
    null,
  )

  const visibleFields = fields.filter((f) => f.is_visible)

  // boolean・section・_id 系フィールド以外から csvFormat / fieldMap を自動生成
  const fillableFields = visibleFields.filter(
    (f) =>
      f.field_type !== 'section' &&
      f.field_type !== 'boolean' &&
      f.field_type !== 'formula' &&
      f.api_name !== 'account_id' && !f.api_name.endsWith('_account_id') &&
      f.api_name !== 'contact_id' && !f.api_name.endsWith('_contact_id'),
  )
  const csvFormat = fillableFields.map((f) => f.label).join(',')
  const fieldMap  = Object.fromEntries(fillableFields.map((f) => [f.label, f.api_name]))

  // ── 離脱ガード: ブラウザのリフレッシュ・閉じる ──────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── 離脱ガード: ページ内リンクのクリック ────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      // 同一ページのアンカーリンクは無視
      if (href.startsWith('#')) return
      const confirmed = window.confirm('変更内容が保存されていません。このページを離れますか？')
      if (!confirmed) e.preventDefault()
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty])

  /** account_id / contact_id / formula / 通常フィールドの入力欄（両バリアント共通） */
  const renderInput = (field: FieldDef, inputClass?: string) => {
    const val    = defaultValues[field.api_name]
    const strVal = val != null ? String(val) : ''

    if (field.api_name === 'account_id' || field.api_name.endsWith('_account_id')) {
      return (
        <SearchableSelect
          name={field.api_name}
          options={accountOptions ?? []}
          defaultValue={strVal}
          placeholder="取引先を選択..."
        />
      )
    }
    if (field.api_name === 'contact_id' || field.api_name.endsWith('_contact_id')) {
      return (
        <SearchableSelect
          name={field.api_name}
          options={contactOptions ?? []}
          defaultValue={strVal}
          placeholder="人物を選択..."
        />
      )
    }
    if (field.field_type === 'formula') {
      return (
        <input
          type="text"
          value={strVal}
          readOnly
          className="w-full border border-zinc-200 bg-zinc-50 rounded-md px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
        />
      )
    }
    return <FieldInput field={field} value={val} inputClass={inputClass} />
  }

  /** フィールドのラベル表示名（_id 系は「 ID」を落とす） */
  const labelOf = (field: FieldDef) => {
    const isRef = field.api_name === 'account_id' || field.api_name.endsWith('_account_id')
      || field.api_name === 'contact_id' || field.api_name.endsWith('_contact_id')
    return isRef ? field.label.replace(/ ?ID$/, '') : field.label
  }

  // ════════════════════════════════════════════════════════════
  // record バリアント: RecordColumns + カード（新規/編集ページ用）
  // ════════════════════════════════════════════════════════════
  if (variant === 'record') {
    // section フィールドでカードに分割（先頭 section 前のフィールドは「基本情報」へ）
    type Group = { title: string; fields: FieldDef[] }
    const groups: Group[] = []
    let current: Group = { title: '基本情報', fields: [] }
    for (const f of visibleFields) {
      if (f.field_type === 'section') {
        if (current.fields.length > 0) groups.push(current)
        current = { title: f.label, fields: [] }
      } else {
        current.fields.push(f)
      }
    }
    if (current.fields.length > 0) groups.push(current)

    // 「テキストから入力」（全フィールドを1フォームに流し込むため、どのカードからでも同じ動作）
    const fillButton = fillableFields.length > 0
      ? <FormFillModal formRef={formRef} csvFormat={csvFormat} fieldMap={fieldMap} />
      : undefined

    return (
      <form id={formId} ref={formRef} action={dispatch} onChange={() => setIsDirty(true)}>
        <CreateFeedback state={state} formRef={formRef} />

        <RecordColumns
          narrow
          left={
            <CreateInfoCard dense title="管理情報" action={fillButton} fields={[]}>
              {userOptions && userOptions.length > 0 && (
                <label className="block">
                  <span className="block text-[12px] text-zinc-500 mb-1">担当者</span>
                  <select name="owner_id" defaultValue={defaultOwnerId ?? ''} className={CARD_INPUT}>
                    <option value="">未設定</option>
                    {userOptions.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </CreateInfoCard>
          }
        >
          {groups.map((g, gi) => (
            <CreateInfoCard key={gi} title={g.title} action={gi === 0 ? fillButton : undefined} fields={[]}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {g.fields.map((field) => (
                  <div key={field.id} className={field.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <span className="block text-xs text-zinc-400 mb-1">
                      {labelOf(field)}
                      {field.is_required && <span className="text-red-500"> *</span>}
                      {field.field_type === 'formula' && <span className="ml-1.5 text-violet-500">数式</span>}
                    </span>
                    {renderInput(field, CARD_INPUT)}
                  </div>
                ))}
              </div>
            </CreateInfoCard>
          ))}
        </RecordColumns>

        {/* 保存/キャンセルはページ最下部（2カラムの外・全幅）に置く */}
        <div className="mt-6 flex justify-center gap-3 border-t border-zinc-200 pt-5">
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '保存中…' : submitLabel}
          </button>
          {cancelHref && (
            <Link href={cancelHref} className="px-6 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
              キャンセル
            </Link>
          )}
        </div>
      </form>
    )
  }

  // ════════════════════════════════════════════════════════════
  // plain バリアント: 従来の1カラム縦並び（詳細のインライン編集用）
  // ════════════════════════════════════════════════════════════

  // ── ボタン（上下共通） ──────────────────────────────────────
  // 離脱確認はドキュメントレベルのクリックインターセプターで処理するため
  // Link の onClick は不要（二重確認を避ける）
  const renderButtons = () => (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? '保存中…' : submitLabel}
      </button>
      {cancelHref && (
        <Link
          href={cancelHref}
          className="px-5 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          キャンセル
        </Link>
      )}
    </div>
  )

  return (
    <form
      ref={formRef}
      action={dispatch}
      className="space-y-5"
      onChange={() => setIsDirty(true)}
    >
      <CreateFeedback state={state} formRef={formRef} />

      {/* ── 上部ボタン ── */}
      {renderButtons()}

      {visibleFields.map((field) => {
        // ── セクション区切り（取引先スタイル） ──
        if (field.field_type === 'section') {
          return (
            <div key={field.id} className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-sm font-bold text-zinc-700 tracking-wide">{field.label}</span>
              <div className="flex-1 h-px bg-zinc-200" />
              {/* 最初のセクションの右横に FormFillModal を配置 */}
              {fillableFields.length > 0 && field.api_name === visibleFields.find(f => f.field_type === 'section')?.api_name && (
                <FormFillModal formRef={formRef} csvFormat={csvFormat} fieldMap={fieldMap} />
              )}
            </div>
          )
        }

        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {labelOf(field)}
              {field.is_required && <span className="ml-1 text-red-500">*</span>}
              {field.field_type === 'formula' && <span className="ml-1.5 text-xs text-violet-500 font-normal">数式</span>}
            </label>
            {renderInput(field)}
          </div>
        )
      })}

      {/* ── 担当者（システムフィールド） ── */}
      {userOptions && userOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">担当者</label>
          <select
            name="owner_id"
            defaultValue={defaultOwnerId ?? ''}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">未設定</option>
            {userOptions.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* セクションが1つもない場合、FormFillModal をフィールド群の直前に表示 */}
      {fillableFields.length > 0 && !visibleFields.some(f => f.field_type === 'section') && (
        <div className="flex justify-end -mb-3">
          <FormFillModal formRef={formRef} csvFormat={csvFormat} fieldMap={fieldMap} />
        </div>
      )}

      {/* ── 下部ボタン ── */}
      <div className="pt-2">
        {renderButtons()}
      </div>
    </form>
  )
}

function FieldInput({ field, value, inputClass }: { field: FieldDef; value: unknown; inputClass?: string }) {
  const base = inputClass ?? 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const strVal = value != null ? String(value) : ''

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          rows={4}
          className={`${base} resize-none`}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          step="any"
          className={base}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          className={base}
        />
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name={field.api_name}
            defaultChecked={!!value}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-zinc-600">{field.label}</span>
        </label>
      )

    case 'select': {
      const options = parseFieldOptions(field.options)
      return (
        <select name={field.api_name} defaultValue={strVal} required={field.is_required} className={`${base} bg-white`}>
          {!field.is_required && <option value="">— 未選択 —</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    default:
      return (
        <input
          type="text"
          name={field.api_name}
          defaultValue={strVal}
          required={field.is_required}
          className={base}
        />
      )
  }
}
