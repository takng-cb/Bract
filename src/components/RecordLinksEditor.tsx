'use client'

/**
 * 関連先（汎用リンク）のインライン編集（REQ-0078）。
 * 詳細ページに置き、検索ボックスで横断検索 → カードで追加、チップで解除する。
 * 送信フォームを持たず、選択の都度サーバアクション（add/removeRecordLink）を呼ぶ。
 * UI は RelatedRecordsPicker（統一検索ボックス）に合わせる。
 */
import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { X, Search, Plus, Loader2, Link2 } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import { addRecordLink, removeRecordLink } from '@/app/actions/recordLinks'
import { showToast } from '@/components/Toast'
import type { ObjectTypeOption } from '@/components/RelatedRecordsPicker'

export type LinkedRecord = { object_api: string; record_id: string; label: string; icon: string; href: string }

type Props = {
  selfApi:      string
  selfId:       string
  objectTypes:  ObjectTypeOption[]
  initialLinks: LinkedRecord[]
}

type Candidate = { object_api: string; record_id: string; label: string; sub?: string; typeLabel: string }

const keyOf = (api: string, id: string) => `${api}:${id}`

async function fetchRecords(objectApi: string, params: Record<string, string>) {
  const sp = new URLSearchParams({ objectType: objectApi, ...params })
  const res = await fetch(`/api/search/records?${sp.toString()}`)
  if (!res.ok) return [] as { id: string; label: string; sub?: string }[]
  return res.json() as Promise<{ id: string; label: string; sub?: string }[]>
}

export default function RecordLinksEditor({ selfApi, selfId, objectTypes, initialLinks }: Props) {
  const [links, setLinks] = useState<LinkedRecord[]>(initialLinks)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const reqIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const linkedKeys = new Set(links.map((l) => keyOf(l.object_api, l.record_id)))

  const search = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setLoading(false); return }
    const reqId = ++reqIdRef.current
    setLoading(true)
    Promise.all(
      objectTypes.map((t) =>
        fetchRecords(t.api, { q: trimmed, limit: '6' }).then((recs) =>
          recs.map((r) => ({ object_api: t.api, record_id: r.id, label: r.label, sub: r.sub, typeLabel: t.label })),
        ),
      ),
    ).then((lists) => {
      if (reqId !== reqIdRef.current) return
      setResults(lists.flat())
      setLoading(false)
    })
  }, [objectTypes])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function onQuery(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 250)
  }

  function add(c: Candidate) {
    const k = keyOf(c.object_api, c.record_id)
    setBusyKey(k)
    startTransition(async () => {
      const res = await addRecordLink(
        { object_api: selfApi, record_id: selfId },
        { object_api: c.object_api, record_id: c.record_id },
      )
      setBusyKey(null)
      if (res.ok) {
        setLinks((prev) => prev.some((l) => keyOf(l.object_api, l.record_id) === k) ? prev : [res.record, ...prev])
        showToast('関連先を追加しました')
      } else {
        showToast(res.error, 'error')
      }
    })
  }

  function remove(l: LinkedRecord) {
    const k = keyOf(l.object_api, l.record_id)
    setBusyKey(k)
    const prev = links
    setLinks((cur) => cur.filter((x) => keyOf(x.object_api, x.record_id) !== k)) // 楽観的
    startTransition(async () => {
      const res = await removeRecordLink(
        { object_api: selfApi, record_id: selfId },
        { object_api: l.object_api, record_id: l.record_id },
      )
      setBusyKey(null)
      if (!res.ok) { setLinks(prev); showToast(res.error, 'error') } // 失敗で復元
    })
  }

  // 検索結果から self・既リンクを除外
  const visibleResults = results.filter((c) =>
    !(c.object_api === selfApi && c.record_id === selfId) && !linkedKeys.has(keyOf(c.object_api, c.record_id)),
  )

  return (
    <div className="space-y-3">
      {/* 既存リンク */}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => {
            const k = keyOf(l.object_api, l.record_id)
            return (
              <span key={k} className="inline-flex items-center gap-1 max-w-full rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs pl-1.5 pr-1 py-0.5">
                <NavIcon icon={l.icon} className="w-3 h-3 shrink-0" />
                <a href={l.href} className="truncate hover:underline">{l.label}</a>
                <button
                  type="button"
                  onClick={() => remove(l)}
                  disabled={pending && busyKey === k}
                  aria-label="関連解除"
                  className="shrink-0 rounded-full hover:bg-brand-100 p-0.5 disabled:opacity-40"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">関連付けられたレコードはありません。</p>
      )}

      {/* 統一検索ボックス */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`名前で検索して関連先を追加（${objectTypes.map((t) => t.label).slice(0, 4).join('・')}${objectTypes.length > 4 ? '…' : ''}）`}
          className="w-full rounded-md border border-zinc-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-brand-400 transition-colors"
        />
        {loading && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden />}
      </div>

      {/* 結果カード */}
      {query.trim() && (
        loading && visibleResults.length === 0 ? (
          <p className="text-xs text-zinc-400 px-1 py-1">検索中…</p>
        ) : visibleResults.length === 0 ? (
          <p className="text-xs text-zinc-400 px-1 py-1">該当するレコードがありません</p>
        ) : (
          <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 max-h-56 overflow-y-auto bg-white">
            {visibleResults.map((c) => {
              const k = keyOf(c.object_api, c.record_id)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => add(c)}
                  disabled={pending && busyKey === k}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm text-zinc-800 truncate">{c.label}</span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">{c.typeLabel}</span>
                  {c.sub && <span className="text-xs text-zinc-400 truncate hidden sm:inline">{c.sub}</span>}
                  <span className="ml-auto shrink-0">
                    {busyKey === k && pending
                      ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" aria-hidden />
                      : <Plus className="w-4 h-4 text-zinc-400" aria-hidden />}
                  </span>
                </button>
              )
            })}
          </div>
        )
      )}

      {links.length === 0 && !query.trim() && (
        <p className="text-xs text-zinc-400 px-1 inline-flex items-center gap-1">
          <Link2 className="w-3 h-3" aria-hidden /> 取引先・人物・商談・カスタムなど、どのレコードとも関連付けられます。
        </p>
      )}
    </div>
  )
}
