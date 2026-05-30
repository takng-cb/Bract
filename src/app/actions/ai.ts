'use server'

/**
 * AI 関連のサーバーアクション。
 *   - 商談 / 物件の活動・ToDo まとめ生成
 *   - 管理者による AI 設定更新
 *
 * セキュリティ:
 *   - まとめ生成は editor 以上 (canEdit 相当)
 *   - 設定更新は管理者のみ (requireAdmin)
 */
import { requireAdmin, requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  summarizeActivitiesAndTasks,
  type SummarizationResult,
} from '@/lib/ai/summarize'
import {
  getAIConfig,
  upsertAISettings,
  type AISettingKey,
  AI_SETTING_KEYS,
} from '@/lib/ai/config'
import { AIDisabledError, AIProviderError, type AIProviderKind } from '@/lib/ai/types'
import { ensureAIFeatureEnabled, AIFeatureDisabledError } from '@/lib/ai/featureFlag'

/** 共通: AI 呼び出し結果を Server Action から返す形に整形 */
type SummaryResponse =
  | { ok: true;  result: SummarizationResult }
  | { ok: false; error: string }

function toResponse(p: Promise<SummarizationResult>): Promise<SummaryResponse> {
  return p
    .then((result) => ({ ok: true as const, result }))
    .catch((e: unknown) => {
      if (e instanceof AIFeatureDisabledError) {
        return { ok: false as const, error: e.message }
      }
      if (e instanceof AIDisabledError) {
        return { ok: false as const, error: e.message }
      }
      if (e instanceof AIProviderError) {
        return {
          ok: false as const,
          error: `${e.provider} API エラー${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}: ${e.message}`,
        }
      }
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      }
    })
}

/**
 * 商談に紐づく活動・ToDo を AI でまとめる（ベース機能）。
 */
export async function summarizeOpportunity(
  opportunityId: string,
  from: string,
  to: string,
): Promise<SummaryResponse> {
  await requireEditor()
  await ensureAIFeatureEnabled()
  const cfg = await getAIConfig()
  return toResponse(summarizeActivitiesAndTasks({
    objectApi:    'opportunity',
    recordId:     opportunityId,
    from,
    to,
    systemPrompt: cfg.prompts.opportunitySummary,
  }))
}

/**
 * 物件に紐づく活動・ToDo を AI でまとめる（real-estate 業種）。
 *
 * 業種チェックはアプリ層では行わず、real-estate UI 以外には公開しない方針。
 * （誤って呼ばれてもエラーにはならない — junction にデータが無いだけ）
 */
export async function summarizeProperty(
  propertyId: string,
  from: string,
  to: string,
): Promise<SummaryResponse> {
  await requireEditor()
  await ensureAIFeatureEnabled()
  const cfg = await getAIConfig()
  return toResponse(summarizeActivitiesAndTasks({
    objectApi:    'properties',
    recordId:     propertyId,
    from,
    to,
    systemPrompt: cfg.prompts.propertySummary,
  }))
}

// ----------------------------------------------------------------
// 管理者専用: AI 設定更新
// ----------------------------------------------------------------

/**
 * AI 設定を FormData から更新する。
 *
 * フィールド:
 *   - ai_provider:                   string ('' / 'groq' / 'gemini' / 'anthropic')
 *   - ai_api_key_{provider}:         string （空文字なら現状維持、'__CLEAR__' で削除）
 *   - ai_model_{provider}:           string
 *   - ai_prompt_opportunity_summary: string
 *   - ai_prompt_property_summary:    string
 *
 * 安全策:
 *   - 空文字のキーは更新しない（誤上書き防止）
 *   - '__CLEAR__' を渡せば削除
 */
export async function updateAISettings(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  try {
    await ensureAIFeatureEnabled()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  const updates: Partial<Record<AISettingKey, string>> = {}
  const allowed = new Set<AISettingKey>([...AI_SETTING_KEYS])
  const validProviders: Array<AIProviderKind | ''> = ['', 'groq', 'gemini', 'anthropic']

  for (const key of allowed) {
    const raw = formData.get(key)
    if (typeof raw !== 'string') continue

    if (key === 'ai_provider') {
      if (!validProviders.includes(raw as AIProviderKind | '')) {
        return { ok: false, error: `不正な provider 値: ${raw}` }
      }
      updates[key] = raw
      continue
    }

    if (key.startsWith('ai_api_key_')) {
      if (raw === '__CLEAR__') {
        updates[key] = ''   // upsertAISettings は空文字を「削除」として扱う
      } else if (raw.trim() === '') {
        // 空文字は「変更しない」と解釈（既存キーを保持）
        continue
      } else {
        updates[key] = raw.trim()
      }
      continue
    }

    // モデル名・プロンプト: 空も許容（空にすればデフォルトに戻る）
    updates[key] = raw
  }

  try {
    await upsertAISettings(updates)
    revalidatePath('/admin/ai')
    revalidatePath('/settings')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * AI 設定の接続テスト — 短いプロンプトで実際に呼んで疎通を確認する。
 * 管理者専用。
 */
export async function testAIConnection(): Promise<{ ok: true; reply: string; provider: string; model: string } | { ok: false; error: string }> {
  await requireAdmin()
  try {
    await ensureAIFeatureEnabled()
    const { callAI } = await import('@/lib/ai/client')
    const r = await callAI({
      system: 'あなたはテスト用アシスタントです。短く、丁寧に応答してください。',
      user:   '接続確認です。「OK」と答えてください。',
      maxTokens: 50,
      temperature: 0,
      timeoutMs: 15000,
    })
    return { ok: true, reply: r.text.trim(), provider: r.provider, model: r.model }
  } catch (e) {
    if (e instanceof AIFeatureDisabledError) return { ok: false, error: e.message }
    if (e instanceof AIDisabledError) return { ok: false, error: e.message }
    if (e instanceof AIProviderError) {
      return { ok: false, error: `${e.provider} API: ${e.message}${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}` }
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
