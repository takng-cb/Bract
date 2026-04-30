import { supabase } from '@/lib/supabase'
import { updateTag } from '@/app/actions/tags'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#71717a',
]

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: tag } = await supabase.from('tags').select('*').eq('id', id).single()
  if (!tag) notFound()

  async function handleUpdate(formData: FormData) {
    'use server'
    await updateTag(id, formData)
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/tags" className="text-sm text-zinc-400 hover:text-zinc-600">← タグ管理</Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">タグを編集</h1>
      </div>

      <form action={handleUpdate} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            タグ名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            defaultValue={tag.name}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">カラー</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {COLOR_PRESETS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c}
                  className="sr-only peer"
                  defaultChecked={tag.color === c}
                />
                <span
                  className="block w-8 h-8 rounded-full ring-2 ring-transparent peer-checked:ring-offset-2 peer-checked:ring-zinc-400 transition-all"
                  style={{ backgroundColor: c }}
                />
              </label>
            ))}
          </div>
          {/* プリセットにない色のフォールバック */}
          {!COLOR_PRESETS.includes(tag.color) && (
            <p className="text-xs text-zinc-500 mb-1">現在の色: {tag.color}</p>
          )}
        </div>

        {/* プレビュー */}
        <div>
          <p className="text-xs text-zinc-500 mb-1">プレビュー</p>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
          <Link href="/tags" className="px-4 py-2 border border-zinc-300 text-sm rounded-md hover:bg-zinc-50 transition-colors">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
