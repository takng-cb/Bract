/**
 * AI 設定の取得・更新。
 *
 * 設定値は system_settings テーブルに保存される。
 * キー一覧:
 *   - ai_provider:           'groq' | 'gemini' | 'anthropic' | '' (空=無効)
 *   - ai_api_key_groq:       Groq API key
 *   - ai_api_key_gemini:     Google AI API key
 *   - ai_api_key_anthropic:  Anthropic API key
 *   - ai_model_groq:         Groq 使用モデル名（省略時 default）
 *   - ai_model_gemini:       Gemini 使用モデル名
 *   - ai_model_anthropic:    Anthropic 使用モデル名
 *   - ai_prompt_opportunity_summary:  商談まとめプロンプト
 *   - ai_prompt_property_summary:     物件まとめプロンプト
 *
 * セキュリティ:
 *   - API キーはサーバーサイドでのみ読み込む
 *   - 管理者以外には返さない（updateAiSettings で権限チェック）
 */
import { db } from '@/lib/db'
import { system_settings } from '@/lib/schema'
import { inArray, eq } from 'drizzle-orm'
import type { AIProviderKind } from './types'
import { AI_DEFAULT_MODELS, AIDisabledError } from './types'

export const AI_SETTING_KEYS = [
  'ai_provider',
  'ai_api_key_groq',
  'ai_api_key_gemini',
  'ai_api_key_anthropic',
  'ai_model_groq',
  'ai_model_gemini',
  'ai_model_anthropic',
  'ai_prompt_opportunity_summary',
  'ai_prompt_property_summary',
] as const

export type AISettingKey = (typeof AI_SETTING_KEYS)[number]

/** デフォルト要約プロンプト — 編集可能 */
export const DEFAULT_OPPORTUNITY_PROMPT = `あなたは CRM の活動履歴を整理するアシスタントです。
以下に商談に紐づく活動 (打合せ・電話・メール等) と ToDo (タスク) のログを期間で抽出したリストを与えます。
これを基に、以下の観点で要約してください:

1. この期間にあった主な動き（時系列で簡潔に）
2. 顧客の意向・温度感（読み取れる範囲で）
3. 次のアクション（既存 ToDo + 推奨される追加アクション）
4. 注意すべきリスクや遅延

日本語で 300〜500 字程度、箇条書きで読みやすく。`

export const DEFAULT_PROPERTY_PROMPT = `あなたは不動産物件管理の活動履歴を整理するアシスタントです。
以下に物件に紐づく活動 (内見・問い合わせ対応・媒介報告等) と ToDo (タスク) のログを期間で抽出したリストを与えます。
これを基に、以下の観点で要約してください:

1. この期間にあった主な動き（内見数・問い合わせ・反響など）
2. 物件への市場の反応（読み取れる範囲で）
3. 次のアクション（既存 ToDo + 推奨される追加アクション）
4. 媒介契約期限など留意点

日本語で 300〜500 字程度、箇条書きで読みやすく。`

export type AIConfig = {
  provider:  AIProviderKind | null  // null = 未設定/無効
  apiKey:    string | null
  model:     string
  /** プロンプト（オブジェクト種別ごとに使い分け） */
  prompts: {
    opportunitySummary: string
    propertySummary:    string
  }
}

/**
 * 公開向けの AI 設定取得（API キー含む）。
 * ⚠ サーバーサイド専用。クライアントに渡してはいけない。
 */
export async function getAIConfig(): Promise<AIConfig> {
  const rows = await db.select()
    .from(system_settings)
    .where(inArray(system_settings.key, [...AI_SETTING_KEYS]))
  const m: Partial<Record<AISettingKey, string>> = {}
  for (const r of rows) m[r.key as AISettingKey] = r.value

  const provider = (m.ai_provider as AIProviderKind) || null
  if (!provider) {
    return {
      provider: null, apiKey: null, model: '',
      prompts: {
        opportunitySummary: m.ai_prompt_opportunity_summary || DEFAULT_OPPORTUNITY_PROMPT,
        propertySummary:    m.ai_prompt_property_summary    || DEFAULT_PROPERTY_PROMPT,
      },
    }
  }

  const apiKey = (
    provider === 'groq'      ? m.ai_api_key_groq :
    provider === 'gemini'    ? m.ai_api_key_gemini :
                               m.ai_api_key_anthropic
  ) || null

  const model = (
    provider === 'groq'      ? m.ai_model_groq :
    provider === 'gemini'    ? m.ai_model_gemini :
                               m.ai_model_anthropic
  ) || AI_DEFAULT_MODELS[provider]

  return {
    provider,
    apiKey,
    model,
    prompts: {
      opportunitySummary: m.ai_prompt_opportunity_summary || DEFAULT_OPPORTUNITY_PROMPT,
      propertySummary:    m.ai_prompt_property_summary    || DEFAULT_PROPERTY_PROMPT,
    },
  }
}

/**
 * 設定有効性チェック。プロバイダ + API キーが揃っているか。
 */
export async function ensureAIEnabled(): Promise<AIConfig & { provider: AIProviderKind; apiKey: string }> {
  const cfg = await getAIConfig()
  if (!cfg.provider) throw new AIDisabledError()
  if (!cfg.apiKey)   throw new AIDisabledError(`AI プロバイダ "${cfg.provider}" の API キーが未設定です。`)
  return cfg as AIConfig & { provider: AIProviderKind; apiKey: string }
}

/**
 * UI 表示用 — API キーをマスクした設定を返す。
 * 管理画面で「保存済み」状態を見せる用途。
 */
export async function getAISettingsForUI(): Promise<{
  provider: AIProviderKind | ''
  hasApiKey: Record<AIProviderKind, boolean>
  models: Record<AIProviderKind, string>
  prompts: { opportunitySummary: string; propertySummary: string }
}> {
  const rows = await db.select()
    .from(system_settings)
    .where(inArray(system_settings.key, [...AI_SETTING_KEYS]))
  const m: Partial<Record<AISettingKey, string>> = {}
  for (const r of rows) m[r.key as AISettingKey] = r.value
  return {
    provider: (m.ai_provider as AIProviderKind) || '',
    hasApiKey: {
      groq:      !!m.ai_api_key_groq,
      gemini:    !!m.ai_api_key_gemini,
      anthropic: !!m.ai_api_key_anthropic,
    },
    models: {
      groq:      m.ai_model_groq      || AI_DEFAULT_MODELS.groq,
      gemini:    m.ai_model_gemini    || AI_DEFAULT_MODELS.gemini,
      anthropic: m.ai_model_anthropic || AI_DEFAULT_MODELS.anthropic,
    },
    prompts: {
      opportunitySummary: m.ai_prompt_opportunity_summary || DEFAULT_OPPORTUNITY_PROMPT,
      propertySummary:    m.ai_prompt_property_summary    || DEFAULT_PROPERTY_PROMPT,
    },
  }
}

/**
 * 設定値を upsert する（管理者専用、Server Action 側で権限チェック済み前提）。
 *
 * 空文字 / undefined は「削除」扱い: 該当行を消す。
 */
export async function upsertAISettings(updates: Partial<Record<AISettingKey, string>>) {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue
    if (value === '') {
      await db.delete(system_settings).where(eq(system_settings.key, key))
      continue
    }
    // upsert: 存在すれば update、無ければ insert
    await db.insert(system_settings)
      .values({ key, value, updated_at: new Date() })
      .onConflictDoUpdate({
        target: system_settings.key,
        set:    { value, updated_at: new Date() },
      })
  }
}
