'use client'

/**
 * 整備レコードの Google Drive 等 外部リンク（カスタム項目）。
 * リンクの追加/削除と、Drive の iframe 埋め込みプレビューを提供する。
 */
import { useState, useTransition } from 'react'
import { ExternalLink, Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toDrivePreviewUrl, type DriveLink } from '@/industries/auto-body/lib/driveEmbed'
import { NavIcon } from '@/lib/navIcon'
import { addMaintenanceDriveLink, removeMaintenanceDriveLink } from '@/industries/auto-body/actions/maintenanceDriveLinks'

export default function MaintenanceDriveLinks({
  maintenanceId, links, canEdit,
}: {
  maintenanceId: string
  links: DriveLink[]
  canEdit: boolean
}) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const add = () => {
    setErr(null)
    start(async () => {
      try {
        await addMaintenanceDriveLink(maintenanceId, label, url)
        setAdding(false); setLabel(''); setUrl('')
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    })
  }
  const remove = (idx: number) => {
    start(async () => { await removeMaintenanceDriveLink(maintenanceId, idx); if (openIdx === idx) setOpenIdx(null) })
  }

  const field = 'border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-700">
          <NavIcon icon="🔗" className="w-4 h-4" />Google Drive / 外部リンク
        </h2>
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus className="w-3 h-3" />リンクを追加
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          <input className={`${field} w-full`} placeholder="ラベル（任意・例: 見積書 / 写真フォルダ）" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className={`${field} w-full`} placeholder="Google Drive の共有 URL（https://drive.google.com/...）" value={url} onChange={(e) => setUrl(e.target.value)} />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={add} disabled={pending || !url.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {pending && <Loader2 className="w-3 h-3 animate-spin" />}追加
            </button>
            <button type="button" onClick={() => { setAdding(false); setErr(null) }} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">キャンセル</button>
          </div>
          <p className="text-[10px] text-zinc-400">※ 共有 URL を貼り付け。埋め込み表示には対象がリンク共有 or 権限のあるアカウントでログインが必要。</p>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-zinc-400">リンクはまだありません。</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l, idx) => {
            const preview = toDrivePreviewUrl(l.url)
            const open = openIdx === idx
            return (
              <li key={idx} className="rounded-md border border-zinc-200">
                <div className="flex items-center gap-2 px-3 py-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{l.label || l.url}</span>
                  </a>
                  {preview ? (
                    <button type="button" onClick={() => setOpenIdx(open ? null : idx)}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 shrink-0">
                      {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{open ? '閉じる' : '埋め込み'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-400 shrink-0">埋め込み不可</span>
                  )}
                  {canEdit && (
                    <button type="button" onClick={() => remove(idx)} disabled={pending}
                      className="text-zinc-400 hover:text-red-600 shrink-0" aria-label="削除"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                {open && preview && (
                  <div className="border-t border-zinc-200 p-2">
                    <iframe src={preview} title={l.label || 'Drive preview'} className="w-full h-96 rounded border border-zinc-200" allow="autoplay" />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
