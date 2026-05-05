'use client'
import { useActionState } from 'react'
import type { ObjectDef } from '@/lib/objectMetadata'

type Props = {
  obj: ObjectDef
  updateAction: (id: string, formData: FormData) => Promise<void>
}

export default function ObjectEditForm({ obj, updateAction }: Props) {
  const [error, dispatch, isPending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      try { await updateAction(obj.id, fd); return null }
      catch (e: unknown) { return (e as Error).message }
    },
    null,
  )

  const base = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form action={dispatch} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">表示名（単数形）</label>
          <input name="label" defaultValue={obj.label} required className={base} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">表示名（複数形）</label>
          <input name="label_plural" defaultValue={obj.label_plural} required className={base} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">アイコン</label>
          <input name="icon" defaultValue={obj.icon} className="w-24 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
            <input type="checkbox" name="nav_enabled" defaultChecked={obj.nav_enabled} className="w-4 h-4 rounded" />
            サイドバーに表示
          </label>
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  )
}
