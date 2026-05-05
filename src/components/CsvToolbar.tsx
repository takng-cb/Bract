'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  exportUrl: string
  importUrl: string
  label: string
  showImport?: boolean
}

export default function CsvToolbar({ exportUrl, importUrl, label, showImport = true }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(importUrl, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'エラーが発生しました')
      setMessage({ type: 'ok', text: `${json.imported} 件インポートしました` })
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage({ type: 'err', text: msg })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      {message && (
        <span className={`text-xs px-2 py-1 rounded ${message.type === 'ok' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
          {message.text}
        </span>
      )}
      <a
        href={exportUrl}
        download
        className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        ↓ CSV出力
      </a>
      {showImport && (
        <label className={`px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
          {importing ? '取込中...' : '↑ CSV取込'}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
        </label>
      )}
    </div>
  )
}
