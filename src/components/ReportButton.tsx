'use client'

/**
 * 業務報告ボタン（#88 Phase 1 / ADR-0025）。
 *
 * 案件・商談の詳細ページに置く。クリックでモーダルを開き、
 *   テンプレート選択 → 期間指定 → AI 要約 → 編集可能な本文 → コピー
 * を行う（その場生成・保存なし。draft-then-apply の読み取り専用側）。
 *
 * 既存 AISummaryButton と機能が一部重なるが、テンプレ選択・編集・コピーを
 * 持つ「報告書」用途のため別コンポーネントにする（AI まとめは現状維持）。
 */
import { useState, useEffect, useTransition } from 'react'
import { NavIcon } from '@/lib/navIcon'
import {
  listReportTemplates, generateReport, createReportTemplate, deleteReportTemplate,
  type ReportTemplate,
} from '@/app/actions/reports'

type GenResult = { summary: string; activityCount: number; taskCount: number; meta: { provider: string; model: string } }

type Props = {
  /** 'opportunity' | 'assignment' */
  targetApi: string
  recordId: string
  /** ボタンに表示する対象名（例: '商談', '案件'） */
  targetLabel: string
  /** 管理者か（共有テンプレ作成の可否） */
  isAdmin: boolean
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const ago = new Date()
  ago.setDate(now.getDate() - 30)
  return { from: ymd(ago), to: ymd(now) }
}

export default function ReportButton({ targetApi, recordId, targetLabel, isAdmin }: Props) {
  const def = defaultRange()
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateId, setTemplateId] = useState('__default__')
  const [from, setFrom] = useState(def.from)
  const [to, setTo] = useState(def.to)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')          // 生成された（編集可能な）本文
  const [genMeta, setGenMeta] = useState<GenResult | null>(null)
  const [copied, setCopied] = useState(false)

  // テンプレ管理（インライン）
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [tplShared, setTplShared] = useState(false)
  const [tplBusy, setTplBusy] = useState(false)

  const loadTemplates = () => {
    listReportTemplates().then(setTemplates).catch(() => setTemplates([]))
  }

  useEffect(() => {
    if (open) loadTemplates()
  }, [open])

  function close() {
    setOpen(false)
    setError(null); setBody(''); setGenMeta(null); setCopied(false)
    setShowTemplateForm(false); setTplName(''); setTplBody(''); setTplShared(false)
  }

  function setPreset(days: number) {
    const now = new Date()
    const past = new Date()
    past.setDate(now.getDate() - days)
    setFrom(ymd(past)); setTo(ymd(now))
  }

  function handleGenerate() {
    setError(null); setCopied(false)
    startTransition(async () => {
      const r = await generateReport(targetApi, recordId, from, to, templateId)
      if (r.ok) { setBody(r.result.summary); setGenMeta(r.result) }
      else { setError(r.error); setBody(''); setGenMeta(null) }
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました。本文を手動で選択してコピーしてください。')
    }
  }

  async function handleSaveTemplate() {
    setTplBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.set('name', tplName)
      fd.set('body', tplBody)
      if (tplShared) fd.set('shared', 'true')
      const r = await createReportTemplate(fd)
      if (!r.ok) { setError(r.error); return }
      setShowTemplateForm(false); setTplName(''); setTplBody(''); setTplShared(false)
      loadTemplates()
    } finally { setTplBusy(false) }
  }

  async function handleDeleteTemplate(id: string) {
    const r = await deleteReportTemplate(id)
    if (!r.ok) { setError(r.error); return }
    if (templateId === id) setTemplateId('__default__')
    loadTemplates()
  }

  const selected = templates.find((t) => t.id === templateId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors shadow-sm"
      >
        <NavIcon icon="📝" className="w-4 h-4" /> 報告を作成
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                <NavIcon icon="📝" className="w-4 h-4" />{targetLabel}の報告を作成
              </h2>
              <button type="button" onClick={close} className="text-zinc-400 hover:text-zinc-600" aria-label="閉じる">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* テンプレート選択 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">テンプレート</p>
                  <button type="button" onClick={() => { setShowTemplateForm((v) => !v); setTplBody(selected?.body ?? '') }}
                    className="text-xs text-violet-600 hover:underline">{showTemplateForm ? '閉じる' : '＋ テンプレートを追加'}</button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {selected && selected.editable && (
                    <button type="button" onClick={() => handleDeleteTemplate(selected.id)}
                      className="text-xs text-zinc-400 hover:text-rose-600 px-2 py-1">削除</button>
                  )}
                </div>

                {showTemplateForm && (
                  <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                    <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="テンプレート名（例: 週次報告）"
                      className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={4}
                      placeholder="報告書の書式・観点を AI への指示として記述（標準テンプレを下敷きに編集できます）"
                      className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    <div className="flex items-center justify-between">
                      <label className={`flex items-center gap-1.5 text-xs ${isAdmin ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        <input type="checkbox" checked={tplShared} onChange={(e) => setTplShared(e.target.checked)} disabled={!isAdmin} />
                        全員で共有（管理者のみ）
                      </label>
                      <button type="button" onClick={handleSaveTemplate} disabled={tplBusy || !tplName.trim() || !tplBody.trim()}
                        className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700 disabled:opacity-50">
                        {tplBusy ? '保存中…' : 'テンプレートを保存'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 期間 */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">期間</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <label className="block">
                    <span className="text-[10px] text-zinc-500 mb-0.5 block">開始日</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-zinc-500 mb-0.5 block">終了日</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setPreset(7)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 7 日</button>
                  <button type="button" onClick={() => setPreset(30)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 30 日</button>
                  <button type="button" onClick={() => setPreset(90)} className="text-xs px-2 py-0.5 rounded border border-zinc-200 hover:bg-zinc-50">直近 90 日</button>
                </div>
              </div>

              <button type="button" onClick={handleGenerate} disabled={pending || !from || !to || from > to}
                className="w-full px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors">
                {pending ? '報告を生成中...' : '報告を生成する'}
              </button>
              {from > to && <p className="text-xs text-rose-600">開始日は終了日より前にしてください</p>}

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-md p-3">
                  <p className="text-sm text-rose-800 whitespace-pre-wrap">{error}</p>
                </div>
              )}

              {/* 生成結果（編集可能） */}
              {genMeta && (
                <div className="border-t border-zinc-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">報告書（編集できます）</p>
                    <p className="text-[10px] text-zinc-400">
                      活動 {genMeta.activityCount} 件 / ToDo {genMeta.taskCount} 件
                      {genMeta.meta.provider && ` · ${genMeta.meta.provider}`}
                    </p>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full border border-violet-200 bg-violet-50/40 rounded-md p-3 text-sm leading-relaxed text-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-white text-sm font-medium rounded-md hover:bg-zinc-700">
                      {copied ? '✓ コピーしました' : '本文をコピー'}
                    </button>
                    <p className="text-[10px] text-zinc-400">※ AI 生成の下書きです。重要事項は元データで確認してください。</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-zinc-200 flex justify-end">
              <button type="button" onClick={close} className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
