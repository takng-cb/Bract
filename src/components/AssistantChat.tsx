'use client'

/**
 * 統一アシスタント（β）の最小チャットUI（PoC / REQ-0088 / ADR-0032）。
 * 自然文の依頼を assistantAsk に渡し、AIが読み取りツールを使って回答する。
 */
import { useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { assistantAsk } from '@/app/actions/assistant'

type Msg = { role: 'user' | 'assistant'; text: string; tools?: string[] }

export default function AssistantChat() {
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setBusy(true)
    try {
      const r = await assistantAsk(q)
      setMsgs((m) => [...m, r.ok ? { role: 'assistant', text: r.answer, tools: r.usedTools } : { role: 'assistant', text: `エラー: ${r.error}` }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
        <Sparkles className="inline w-3.5 h-3.5 mr-1" aria-hidden />
        β版: 自然文で依頼すると、AI が検索などのツールを使って回答します（現在は<b>読み取りのみ</b>・作成はしません）。
      </div>

      {msgs.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto px-0.5">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-left ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-800'}`}>{m.text}</div>
              {m.tools && m.tools.length > 0 && <div className="mt-0.5 text-[10px] text-zinc-400">使用ツール: {m.tools.join(', ')}</div>}
            </div>
          ))}
          {busy && <div className="inline-flex items-center gap-1.5 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" />考え中…</div>}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
          rows={2}
          placeholder="例: 山田製作所の最近の活動をまとめて"
          className="flex-1 rounded-lg border border-zinc-300 p-2 text-sm focus:border-violet-400 focus:outline-none"
        />
        <button onClick={send} disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-zinc-400">⌘/Ctrl + Enter で送信。β版のため誤りを含むことがあります。</p>
    </div>
  )
}
