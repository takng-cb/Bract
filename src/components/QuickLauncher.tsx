'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronLeft, Sparkles, PencilLine, FilePlus2, Eye, ImagePlus, Loader2 } from 'lucide-react'
import { NavIcon } from '@/lib/navIcon'
import type { QuickModule, QuickBook } from '@/lib/modules/quick'
import {
  quickAiExtract, quickAiCreate, quickAiDupCandidates, type QuickAiDup,
  type QuickAiField, type QuickAiDraft,
} from '@/app/actions/quickAi'

/**
 * グローバル「クイック操作」ウィザード（REQ-0022）
 *
 * フロー（ユーザー定義）:
 *   ① レコード作成 / レコード閲覧
 *   作成 → ② AI作成 / 手動入力
 *     AI作成   → モジュール選択 → ブック選択 → 自由入力/画像 → 確認(編集可) → 作成
 *     手動入力 → モジュール選択 → ブック選択 → 新規入力画面へ遷移
 *   閲覧 → モジュール選択 → ブック選択 → 一覧へ遷移
 */
type Step = 'root' | 'createMode' | 'module' | 'book' | 'aiInput' | 'aiConfirm' | 'aiNotSupported'
type Mode = 'create' | 'view'
type CreateMode = 'ai' | 'manual'

export default function QuickLauncher({ modules }: { modules: QuickModule[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // ウィザード状態
  const [step, setStep] = useState<Step>('root')
  const [mode, setMode] = useState<Mode>('create')
  const [createMode, setCreateMode] = useState<CreateMode>('manual')
  const [mod, setMod] = useState<QuickModule | null>(null)
  const [book, setBook] = useState<QuickBook | null>(null)

  // AI 入力
  const [aiText, setAiText] = useState('')
  const [aiUrl, setAiUrl] = useState('')
  const [aiImage, setAiImage] = useState<{ mediaType: string; dataBase64: string; preview: string } | null>(null)
  const [draft, setDraft] = useState<QuickAiDraft | null>(null)
  const [dups, setDups] = useState<QuickAiDup[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('root'); setMode('create'); setCreateMode('manual')
    setMod(null); setBook(null)
    setAiText(''); setAiUrl(''); setAiImage(null); setDraft(null); setDups([]); setBusy(false); setError(null)
  }, [])

  const close = useCallback(() => { setOpen(false); reset() }, [reset])

  // Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // モバイル下部タブ中央 FAB から開く（BottomNav が dispatch）
  useEffect(() => {
    const onOpen = () => { reset(); setOpen(true) }
    window.addEventListener('bract:quick-open', onOpen)
    return () => window.removeEventListener('bract:quick-open', onOpen)
  }, [reset])

  if (modules.length === 0) return null

  // ── 遷移ハンドラ ───────────────────────────────────────────────
  const go = (href: string) => { close(); router.push(href) }

  const pickModule = (m: QuickModule) => { setMod(m); setStep('book') }

  const pickBook = (b: QuickBook) => {
    setBook(b)
    if (mode === 'view') return go(b.listHref)
    if (createMode === 'manual') return go(b.newHref)
    // createMode === 'ai'
    if (b.aiCreate) { setError(null); setDraft(null); setAiText(''); setAiUrl(''); setAiImage(null); setStep('aiInput') }
    else if (b.aiWizardHref) go(b.aiWizardHref)
    else setStep('aiNotSupported')
  }

  const onPickImage = (file: File | null) => {
    if (!file) return setAiImage(null)
    if (!file.type.startsWith('image/')) { setError('画像ファイルを選択してください'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const base64 = dataUrl.split(',')[1] ?? ''
      setAiImage({ mediaType: file.type, dataBase64: base64, preview: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  const runExtract = async () => {
    if (!book) return
    setBusy(true); setError(null)
    try {
      const d = await quickAiExtract(book.apiName, {
        text: aiText || undefined,
        url: aiUrl.trim() || undefined,
        image: aiImage ? { mediaType: aiImage.mediaType, dataBase64: aiImage.dataBase64 } : undefined,
      })
      setDraft(d); setStep('aiConfirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const updField = (apiName: string, value: string) =>
    setDraft((p) => p ? { ...p, fields: p.fields.map((f) => f.apiName === apiName ? { ...f, value } : f) } : p)

  const runCreate = async (force = false) => {
    if (!book || !draft) return
    setBusy(true); setError(null)
    try {
      const values: Record<string, string> = {}
      for (const f of draft.fields) values[f.apiName] = f.value
      // 重複確認（REQ-0018）: 自然キー一致候補があれば確認を出す
      if (!force) {
        const candidates = await quickAiDupCandidates(book.apiName, values)
        if (candidates.length > 0) { setDups(candidates); setBusy(false); return }
      }
      const { recordHref } = await quickAiCreate(book.apiName, values)
      go(recordHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  // ── 戻る ───────────────────────────────────────────────────────
  const back = () => {
    setError(null)
    switch (step) {
      case 'createMode': return setStep('root')
      case 'module':     return setStep(mode === 'view' ? 'root' : 'createMode')
      case 'book':       return setStep('module')
      case 'aiInput':
      case 'aiNotSupported': return setStep('book')
      case 'aiConfirm':  return setStep('aiInput')
      default:           return setStep('root')
    }
  }

  const title =
    step === 'root' ? 'クイック操作' :
    step === 'createMode' ? 'レコード作成' :
    step === 'module' ? (mode === 'view' ? '閲覧するモジュール' : 'モジュールを選択') :
    step === 'book' ? `${mod?.name ?? ''} のブック` :
    step === 'aiInput' ? `AI作成 — ${book?.label ?? ''}` :
    step === 'aiConfirm' ? '内容を確認・編集' :
    'AI作成は準備中'

  const moduleList = modules.filter((m) => m.books.length > 0)

  return (
    <>
      {/* デスクトップ右下フローティングボタン */}
      <button
        onClick={() => { reset(); setOpen(true) }}
        title="クイック操作"
        data-testid="quick-launcher-open"
        className="print:hidden hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="text-sm font-medium hidden sm:inline">クイック</span>
      </button>

      {open && (
        <div
          className="print:hidden fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダ（戻る + タイトル + 閉じる） */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-4 py-3">
              {step !== 'root' ? (
                <button onClick={back} className="text-zinc-400 hover:text-zinc-700" aria-label="戻る"><ChevronLeft className="w-5 h-5" /></button>
              ) : <span className="w-5" />}
              <h2 className="flex-1 text-base font-bold text-zinc-900 truncate">{title}</h2>
              <button onClick={close} className="text-zinc-400 hover:text-zinc-700" aria-label="閉じる"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4">
              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
              )}

              {/* ① 作成 / 閲覧 */}
              {step === 'root' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BigChoice icon={<FilePlus2 className="w-6 h-6" />} label="レコード作成" desc="新しいデータを登録"
                    onClick={() => { setMode('create'); setStep('createMode') }} />
                  <BigChoice icon={<Eye className="w-6 h-6" />} label="レコード閲覧" desc="一覧を開いて確認"
                    onClick={() => { setMode('view'); setStep('module') }} />
                </div>
              )}

              {/* ② AI作成 / 手動入力 */}
              {step === 'createMode' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BigChoice icon={<Sparkles className="w-6 h-6 text-violet-600" />} label="AI作成" desc="文章・画像から自動入力" accent="violet"
                    onClick={() => { setCreateMode('ai'); setStep('module') }} />
                  <BigChoice icon={<PencilLine className="w-6 h-6" />} label="手動入力" desc="フォームに直接入力"
                    onClick={() => { setCreateMode('manual'); setStep('module') }} />
                </div>
              )}

              {/* モジュール選択 */}
              {step === 'module' && (
                <div className="space-y-1.5">
                  {moduleList.map((m) => (
                    <button key={m.id} onClick={() => pickModule(m)}
                      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <NavIcon icon={m.icon} className="w-5 h-5 shrink-0 text-zinc-500" />
                      <span className="flex-1 text-sm font-medium text-zinc-800">{m.name}</span>
                      <span className="text-xs text-zinc-400">{m.books.length} ブック</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ブック選択 */}
              {step === 'book' && mod && (
                <div className="space-y-1.5">
                  {createMode === 'ai' && mode === 'create' && (
                    <p className="mb-1 text-xs text-zinc-400">AI作成できないブックは手動入力または専用ウィザードに切り替わります。</p>
                  )}
                  {mod.books.map((b) => (
                    <button key={b.apiName} onClick={() => pickBook(b)}
                      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <NavIcon icon={b.icon} className="w-5 h-5 shrink-0 text-zinc-500" />
                      <span className="flex-1 text-sm font-medium text-zinc-800">{b.label}</span>
                      {mode === 'create' && createMode === 'ai' && (b.aiCreate || b.aiWizardHref) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"><Sparkles className="w-3 h-3" />AI</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* AI入力（自由入力 + 画像） */}
              {step === 'aiInput' && book && (
                <div className="space-y-3">
                  <textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    rows={5}
                    placeholder={`「${book.label}」の内容を自由に入力（例: メモ・メール・FAX 文面・名刺の文字など）`}
                    className="w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Webサイト / SNS の URL から取り込む（任意）</label>
                    <input
                      type="url"
                      value={aiUrl}
                      onChange={(e) => setAiUrl(e.target.value)}
                      placeholder="https://example.co.jp"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                      <ImagePlus className="w-4 h-4" />
                      画像（名刺等）から読み取る
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
                    </label>
                    {aiImage && (
                      <div className="mt-2 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={aiImage.preview} alt="プレビュー" className="h-16 w-16 rounded border border-zinc-200 object-cover" />
                        <button onClick={() => setAiImage(null)} className="text-xs text-zinc-500 hover:text-red-600">画像を外す</button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={runExtract}
                    disabled={busy || (!aiText.trim() && !aiImage && !aiUrl.trim())}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {busy ? '解析中…' : 'AIで解析'}
                  </button>
                  <p className="text-xs text-zinc-400">※ 解析結果は次の画面で確認・編集してから作成します（自動反映しません）。</p>
                </div>
              )}

              {/* AI確認（編集可能） */}
              {step === 'aiConfirm' && draft && (
                <div className="space-y-3">
                  {draft.note && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">要確認: {draft.note}</div>
                  )}
                  <div className="grid grid-cols-1 gap-2.5">
                    {draft.fields.map((f) => (
                      <DraftField key={f.apiName} field={f} onChange={(v) => updField(f.apiName, v)} />
                    ))}
                  </div>

                  {dups.length > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-800">同名・類似のレコードが見つかりました</p>
                      <p className="text-xs text-amber-700">重複を避けるため、既存を開くか、それでも新規作成するか選んでください。</p>
                      <div className="space-y-1">
                        {dups.map((d) => (
                          <a key={d.id} href={d.href} onClick={close} className="block rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">✓ 既存「{d.label}」を開く</a>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => runCreate(true)} disabled={busy}
                          className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                          {busy ? '作成中…' : 'それでも新規作成する'}
                        </button>
                        <button onClick={() => setDups([])} disabled={busy} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">戻る</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={() => runCreate(false)} disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        {busy ? '作成中…' : 'この内容で作成'}
                      </button>
                      <button onClick={() => setStep('aiInput')} disabled={busy} className="text-sm text-zinc-500 hover:text-zinc-800">入力に戻る</button>
                    </div>
                  )}
                </div>
              )}

              {/* AI未対応ブック */}
              {step === 'aiNotSupported' && book && (
                <div className="space-y-3 text-sm text-zinc-600">
                  <p>「{book.label}」の AI 作成は準備中です。手動入力をご利用ください。</p>
                  <button onClick={() => go(book.newHref)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                    <PencilLine className="w-4 h-4" />手動入力で作成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BigChoice({ icon, label, desc, onClick, accent }: {
  icon: React.ReactNode; label: string; desc: string; onClick: () => void; accent?: 'violet'
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
        accent === 'violet' ? 'border-violet-200 hover:border-violet-400 hover:bg-violet-50' : 'border-zinc-200 hover:border-blue-300 hover:bg-blue-50'
      }`}>
      <span className="text-zinc-700">{icon}</span>
      <span className="text-sm font-semibold text-zinc-900">{label}</span>
      <span className="text-xs text-zinc-500">{desc}</span>
    </button>
  )
}

function DraftField({ field, onChange }: { field: QuickAiField; onChange: (v: string) => void }) {
  const base = 'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none'
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 mb-1">{field.label}</span>
      {field.fieldType === 'select' && field.options && field.options.length > 0 ? (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.fieldType === 'textarea' ? (
        <textarea value={field.value} onChange={(e) => onChange(e.target.value)} rows={3} className={base} />
      ) : field.fieldType === 'boolean' ? (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          <option value="true">はい</option>
          <option value="false">いいえ</option>
        </select>
      ) : (
        <input
          type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
    </label>
  )
}
