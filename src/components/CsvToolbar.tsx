'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import TextImportModal from './TextImportModal'

type Props = {
  exportUrl:    string
  importUrl:    string
  label:        string
  csvFormat:    string   // テキストインポートモーダル内に表示するフォーマット文字列
  showImport?:  boolean
}

export default function CsvToolbar({
  exportUrl,
  importUrl,
  label,
  csvFormat,
  showImport = true,
}: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [message,   setMessage]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(importUrl, { method: 'POST', body: fd })
      const json = await res.json() as { imported?: number; updated?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'エラーが発生しました')

      const parts: string[] = []
      if (json.imported) parts.push(`${json.imported} 件追加`)
      if (json.updated)  parts.push(`${json.updated} 件更新`)
      setMessage({ type: 'ok', text: parts.length > 0 ? parts.join('、') + 'しました' : '変更なし' })
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
        <span className={`text-xs px-2 py-1 rounded ${
          message.type === 'ok' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
        }`}>
          {message.text}
        </span>
      )}

      {/* エクスポート */}
      <a
        href={exportUrl}
        download
        className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors"
      >
        ↓ エクスポート
      </a>

      {showImport && (
        <>
          {/* ファイルインポート */}
          <label className={`px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs font-medium rounded-md hover:bg-zinc-50 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? 'インポート中...' : '📁 ファイル'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileImport}
            />
          </label>

          {/* テキストインポート */}
          <TextImportModal
            importUrl={importUrl}
            title={`${label}をテキストインポート`}
            csvFormat={csvFormat}
          />
        </>
      )}
    </div>
  )
}
