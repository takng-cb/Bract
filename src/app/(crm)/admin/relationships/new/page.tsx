import { requireAdmin } from '@/lib/auth'
import { createRelationshipDefinition } from '@/app/actions/relationships'
import { getSelectableObjectTypes } from '@/lib/relationships'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'
import Link from 'next/link'

export default async function NewRelationshipPage() {
  await requireAdmin()

  // 組み込み + カスタムオブジェクトを動的に取得
  const objectTypes = await getSelectableObjectTypes()

  async function handleCreate(formData: FormData) {
    'use server'
    await createRelationshipDefinition(formData)
    redirect(withSaveToast('/admin/relationships', 'created'))
  }

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/admin/relationships" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← 関係性管理に戻る
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">関係性を追加</h1>
        <p className="text-sm text-zinc-500 mt-1">
          ブック間の多対多リレーションを定義します
        </p>
      </div>

      <form action={handleCreate} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-5">
        {/* ソースブック */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            ソース（起点）ブック <span className="text-red-500">*</span>
          </label>
          <select
            name="source_object_type"
            required
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {objectTypes.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* ターゲットブック */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            ターゲット（終点）ブック <span className="text-red-500">*</span>
          </label>
          <select
            name="target_object_type"
            required
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {objectTypes.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* ラベル（ソース側の表示名） */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            ラベル（ソース側） <span className="text-red-500">*</span>
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder="例: 関連商談"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-400 mt-1">ソース側の詳細ページに表示されるラベル</p>
        </div>

        {/* 逆ラベル（ターゲット側の表示名） */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            逆ラベル（ターゲット側）
          </label>
          <input
            name="reverse_label"
            type="text"
            placeholder="例: 関連物件"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-400 mt-1">ターゲット側の詳細ページに表示されるラベル（省略可）</p>
        </div>

        {/* カーディナリティ */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">種別</label>
          <select
            name="cardinality"
            defaultValue="many_to_many"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="many_to_many">多対多</option>
            <option value="one_to_many">一対多</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
          <Link
            href="/admin/relationships"
            className="px-5 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
