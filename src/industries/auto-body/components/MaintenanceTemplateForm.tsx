'use client'

import { useActionState } from 'react'
import Link from 'next/link'

type Props = {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>
  cancelHref: string
  defaultValues?: {
    name?: string | null
    description?: string | null
    category?: string | null
    is_active?: boolean
    sort_order?: number | null
  }
}

const CATEGORIES = ['車検', '一般整備', '点検', '板金修理', '事故修理', '新車納車整備', 'その他']

export default function MaintenanceTemplateForm({ action, cancelHref, defaultValues = {} }: Props) {
  const [error, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            テンプレ名 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={defaultValues.name ?? ''}
            placeholder="例: 車検基本パック（普通車）"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">カテゴリ</label>
            <select name="category" defaultValue={defaultValues.category ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">並び順</label>
            <input
              type="number"
              name="sort_order"
              defaultValue={defaultValues.sort_order ?? 0}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">説明（任意）</label>
          <textarea
            name="description"
            defaultValue={defaultValues.description ?? ''}
            rows={2}
            placeholder="例: 24ヶ月点検 + ブレーキ分解清掃 + オイル類交換 + 自賠責/重量税"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
            <input
              type="checkbox"
              name="is_active"
              value="true"
              defaultChecked={defaultValues.is_active ?? true}
              className="w-4 h-4 rounded"
            />
            有効（無効にすると適用候補から隠れます）
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
        >
          {pending ? '保存中…' : '保存'}
        </button>
        <Link href={cancelHref}
          className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md hover:bg-zinc-50">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
