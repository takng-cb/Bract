'use client'
import { useActionState } from 'react'
import { createObjectDef } from '@/app/actions/objectDefinitions'
import Link from 'next/link'

export default function NewObjectPage() {
  const [error, dispatch, isPending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      try { await createObjectDef(fd); return null }
      catch (e: unknown) { return (e as Error).message }
    },
    null,
  )

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/admin/books" className="text-sm text-zinc-400 hover:text-zinc-600">← オブジェクト管理</Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">新規オブジェクト作成</h1>
      </div>

      <form action={dispatch} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            API名 <span className="text-red-500">*</span>
          </label>
          <input
            name="api_name"
            type="text"
            required
            placeholder="例: contracts, products"
            pattern="[a-z][a-z0-9_]*"
            title="英小文字・数字・アンダースコアのみ（先頭は英字）"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-400 mt-1">英小文字・数字・アンダースコアのみ。URLに使われます。後から変更できません。</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            表示名（単数形）<span className="text-red-500">*</span>
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder="例: 契約"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            表示名（複数形・一覧名）<span className="text-red-500">*</span>
          </label>
          <input
            name="label_plural"
            type="text"
            required
            placeholder="例: 契約一覧"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">アイコン（絵文字）</label>
          <input
            name="icon"
            type="text"
            defaultValue="📦"
            placeholder="📦"
            className="w-24 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '作成中…' : '作成'}
          </button>
          <Link
            href="/admin/books"
            className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
