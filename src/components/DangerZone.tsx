'use client'

import { useState, useTransition } from 'react'
import { deleteAllData } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'
import { activeIndustry } from '@/lib/industry'

const CONFIRM_WORD = 'DELETE'

export default function DangerZone() {
  const [input,    setInput]   = useState('')
  const [result,   setResult]  = useState<{ error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const canDelete = input === CONFIRM_WORD

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAllData()
      if (res.error) {
        setResult(res)
      } else {
        setResult(null)
        setInput('')
        router.push('/accounts')
      }
    })
  }

  return (
    <section className="bg-white border border-red-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-red-700 mb-1 flex items-center gap-2">
        <span>⚠️</span> 危険ゾーン
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        以下の操作は取り消せません。管理者のみ実行できます。
      </p>

      <div className="border border-red-100 rounded-lg p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-zinc-800">全データを削除</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            取引先・担当者・商談・活動履歴・ToDo・経費{activeIndustry === 'real-estate' && '・物件'}のデータをすべて削除します。
            システム設定・タグ・ユーザー設定は保持されます。
          </p>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            実行するには <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-red-600">{CONFIRM_WORD}</code> と入力してください
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setResult(null) }}
            placeholder={CONFIRM_WORD}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
            disabled={isPending}
          />
        </div>

        {result?.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {result.error}
          </p>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete || isPending}
          className="w-full py-2 px-4 text-sm font-medium rounded-md transition-colors
            bg-red-600 text-white hover:bg-red-700
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? '削除中...' : '全データを削除する'}
        </button>
      </div>
    </section>
  )
}
