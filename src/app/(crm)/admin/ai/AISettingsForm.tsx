'use client'

/**
 * AI 設定フォーム（クライアントコンポーネント）。
 *
 * - プロバイダ選択 (radio)
 * - 各プロバイダの API キー + モデル
 * - 商談まとめ / 物件まとめのプロンプト編集
 * - 接続テストボタン
 *
 * API キーは保存済みなら "保存済み — 上書きには新規入力" と表示。
 * 空欄のまま保存すれば変更しない。`__CLEAR__` を入力すれば削除。
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateAISettings, testAIConnection } from '@/app/actions/ai'
import { AI_PROVIDER_LABELS, AI_DEFAULT_MODELS, type AIProviderKind } from '@/lib/ai/types'
import { NavIcon } from '@/lib/navIcon'
import { showToast } from '@/components/Toast'

const PROVIDERS: Array<AIProviderKind | ''> = ['', 'groq', 'gemini', 'anthropic']

type Props = {
  initial: {
    provider:  AIProviderKind | ''
    hasApiKey: Record<AIProviderKind, boolean>
    models:    Record<AIProviderKind, string>
    prompts: {
      opportunitySummary: string
      propertySummary:    string
    }
  }
  defaultPrompts: {
    opportunitySummary: string
    propertySummary:    string
  }
}

const FIELD_CLS = 'w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export default function AISettingsForm({ initial, defaultPrompts }: Props) {
  const [provider, setProvider] = useState<AIProviderKind | ''>(initial.provider)
  const [groqKey,      setGroqKey]      = useState('')
  const [geminiKey,    setGeminiKey]    = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [groqModel,      setGroqModel]      = useState(initial.models.groq)
  const [geminiModel,    setGeminiModel]    = useState(initial.models.gemini)
  const [anthropicModel, setAnthropicModel] = useState(initial.models.anthropic)
  const [oppPrompt, setOppPrompt] = useState(initial.prompts.opportunitySummary)
  const [propPrompt, setPropPrompt] = useState(initial.prompts.propertySummary)
  // 保存成功はグローバルトーストで通知（REQ-0057）。エラーのみ inline 表示。
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [testPending, startTestTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setTestResult(null)
    const fd = new FormData()
    fd.set('ai_provider', provider)
    if (groqKey)      fd.set('ai_api_key_groq', groqKey)
    if (geminiKey)    fd.set('ai_api_key_gemini', geminiKey)
    if (anthropicKey) fd.set('ai_api_key_anthropic', anthropicKey)
    fd.set('ai_model_groq',      groqModel)
    fd.set('ai_model_gemini',    geminiModel)
    fd.set('ai_model_anthropic', anthropicModel)
    fd.set('ai_prompt_opportunity_summary', oppPrompt)
    fd.set('ai_prompt_property_summary',    propPrompt)

    startTransition(async () => {
      const r = await updateAISettings(fd)
      if (r.ok) {
        showToast('AI設定を保存しました')
        setGroqKey(''); setGeminiKey(''); setAnthropicKey('')
        router.refresh()
      } else {
        setErrorMsg(r.error)
      }
    })
  }

  function handleTest() {
    setTestResult(null)
    setErrorMsg(null)
    startTestTransition(async () => {
      const r = await testAIConnection()
      if (r.ok) {
        setTestResult({ ok: true,  text: `${r.provider} (${r.model}) → "${r.reply}"` })
      } else {
        setTestResult({ ok: false, text: `${r.error}` })
      }
    })
  }

  function clearKey(p: AIProviderKind) {
    if (!confirm(`${AI_PROVIDER_LABELS[p]} の API キーを削除しますか？`)) return
    const fd = new FormData()
    fd.set(`ai_api_key_${p}`, '__CLEAR__')
    startTransition(async () => {
      const r = await updateAISettings(fd)
      if (r.ok) {
        showToast(`${AI_PROVIDER_LABELS[p]} の API キーを削除しました`)
        router.refresh()
      } else {
        setErrorMsg(r.error)
      }
    })
  }

  function resetPrompt(which: 'opp' | 'prop') {
    if (which === 'opp') {
      setOppPrompt(defaultPrompts.opportunitySummary)
    } else {
      setPropPrompt(defaultPrompts.propertySummary)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラーメッセージ */}
      {errorMsg && (
        <div className="rounded-md p-3 text-sm bg-rose-50 text-rose-700 border border-rose-200">
          {errorMsg}
        </div>
      )}

      {/* プロバイダ選択 */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <h2 className="text-sm font-bold text-zinc-700 mb-4">使用プロバイダ</h2>
        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <label key={p || 'none'} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-zinc-50">
              <input
                type="radio"
                name="ai_provider"
                value={p}
                checked={provider === p}
                onChange={() => setProvider(p)}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-sm text-zinc-800">
                {p === '' ? '無効 (AI 機能を使わない)' : AI_PROVIDER_LABELS[p]}
              </span>
              {p && initial.hasApiKey[p] && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">APIキー保存済み</span>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* API キー */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-5">
        <h2 className="text-sm font-bold text-zinc-700">API キー</h2>

        {/* Groq */}
        <ApiKeyRow
          label="Groq API キー"
          hint="https://console.groq.com/keys で取得"
          hasKey={initial.hasApiKey.groq}
          value={groqKey}
          onChange={setGroqKey}
          onClear={() => clearKey('groq')}
          model={groqModel}
          setModel={setGroqModel}
          modelPlaceholder={AI_DEFAULT_MODELS.groq}
        />

        {/* Gemini */}
        <ApiKeyRow
          label="Google Gemini API キー"
          hint="https://aistudio.google.com/apikey で取得"
          hasKey={initial.hasApiKey.gemini}
          value={geminiKey}
          onChange={setGeminiKey}
          onClear={() => clearKey('gemini')}
          model={geminiModel}
          setModel={setGeminiModel}
          modelPlaceholder={AI_DEFAULT_MODELS.gemini}
        />

        {/* Anthropic */}
        <ApiKeyRow
          label="Anthropic Claude API キー"
          hint="https://console.anthropic.com/settings/keys で取得"
          hasKey={initial.hasApiKey.anthropic}
          value={anthropicKey}
          onChange={setAnthropicKey}
          onClear={() => clearKey('anthropic')}
          model={anthropicModel}
          setModel={setAnthropicModel}
          modelPlaceholder={AI_DEFAULT_MODELS.anthropic}
        />
      </section>

      {/* プロンプト */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-700">プロンプト</h2>
          <p className="text-[10px] text-zinc-400">各ブックの「まとめ」生成時に AI に渡すシステム指示</p>
        </div>

        <PromptField
          label="商談まとめ（ベース機能）"
          value={oppPrompt}
          onChange={setOppPrompt}
          onReset={() => resetPrompt('opp')}
        />
        <PromptField
          label="物件まとめ（不動産業種）"
          value={propPrompt}
          onChange={setPropPrompt}
          onReset={() => resetPrompt('prop')}
        />
      </section>

      {/* 接続テスト */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-700">接続テスト</h2>
          <button
            type="button"
            onClick={handleTest}
            disabled={testPending || !provider}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-violet-300 text-violet-700 rounded-md hover:bg-violet-50 disabled:opacity-50"
          >
            {testPending ? 'テスト中...' : (<><NavIcon icon="🧪" className="w-3.5 h-3.5 shrink-0" />接続テスト</>)}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-2">
          保存済みの設定で実際に API を呼び出して疎通確認します。
        </p>
        {testResult && (
          <div className={`rounded-md p-3 text-sm whitespace-pre-wrap ${
            testResult.ok ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {testResult.text}
          </div>
        )}
      </section>

      {/* 保存ボタン */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 shadow-sm"
        >
          {pending ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}

// ─── サブコンポーネント ─────────────────────────────────────────

function ApiKeyRow(props: {
  label: string
  hint: string
  hasKey: boolean
  value: string
  onChange: (v: string) => void
  onClear: () => void
  model: string
  setModel: (v: string) => void
  modelPlaceholder: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-zinc-700">{props.label}</label>
        {props.hasKey && (
          <button
            type="button"
            onClick={props.onClear}
            className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline"
          >
            削除
          </button>
        )}
      </div>
      <input
        type="password"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.hasKey ? '保存済み — 上書きには新規入力' : '未設定'}
        className={FIELD_CLS}
        autoComplete="new-password"
      />
      <p className="text-[10px] text-zinc-400 mt-1">{props.hint}</p>
      <div className="mt-2">
        <label className="text-[10px] text-zinc-500 mb-0.5 block">モデル名</label>
        <input
          value={props.model}
          onChange={(e) => props.setModel(e.target.value)}
          placeholder={props.modelPlaceholder}
          className={FIELD_CLS}
        />
      </div>
    </div>
  )
}

function PromptField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  onReset: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-zinc-700">{props.label}</label>
        <button
          type="button"
          onClick={props.onReset}
          className="text-[10px] text-zinc-500 hover:text-zinc-700 hover:underline"
        >
          デフォルトに戻す
        </button>
      </div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={8}
        className={`${FIELD_CLS} resize-y font-mono text-xs`}
      />
    </div>
  )
}
