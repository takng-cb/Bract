/**
 * 統一アシスタントのエージェントランナー（REQ-0088 / ADR-0032）。
 *
 * provider 非依存の JSON ツールループ：モデルに「ツール呼び出し or 最終回答」を
 * 厳密 JSON で出させ、パース→ツール実行→結果を会話に戻して再入力、を上限まで回す。
 * native function-calling は後続フェーズで provider 層に追加（ハードニング）。
 *
 * 安全：読み取りツール前提（書き込みは draft-then-apply で別途）／ステップ上限で暴走防止／
 * モデル補完は注入（complete）でキー無しでもユニットテスト可能。
 */
import { extractJson } from '@/lib/ai/extractJson'
import type { AgentAction, AgentResult, AgentStep, AgentTool, CompleteFn } from './types'

/** モデル出力（JSON）を行動に解釈。解釈不能なら null。 */
export function parseAgentAction(text: string): AgentAction | null {
  const o = extractJson<Record<string, unknown>>(text)
  if (!o || typeof o.action !== 'string') return null
  if (o.action === 'final') return { action: 'final', answer: typeof o.answer === 'string' ? o.answer : '' }
  if (o.action === 'tool' && typeof o.tool === 'string') {
    const args = o.args && typeof o.args === 'object' ? (o.args as Record<string, unknown>) : {}
    return { action: 'tool', tool: o.tool, args }
  }
  return null
}

/** ツール一覧を載せた system プロンプトを組み立てる。 */
export function buildAgentSystem(tools: AgentTool[]): string {
  const list = tools.map((t) => `- ${t.name}: ${t.description}  引数 ${t.args}`).join('\n')
  return [
    'あなたは Bract（CRM/ERP）の業務アシスタントです。ユーザーの依頼を、必要に応じてツールを使って達成します。',
    '出力は必ず厳密な JSON のみ（前後に説明文やコードフェンスを付けない）。',
    'ツールを使う場合: {"action":"tool","tool":"<ツール名>","args":{...}}',
    '回答できる場合: {"action":"final","answer":"<日本語の回答>"}',
    'ルール:',
    '- 必要なときだけツールを使う。十分な情報が集まったら final で日本語の回答を返す。',
    '- ツール結果に無い固有名詞や数値を創作しない。分からなければ分からないと答える。',
    '- 同じツールを同じ引数で無意味に繰り返さない。',
    '利用可能なツール:',
    list || '（なし）',
  ].join('\n')
}

/**
 * エージェントを上限付きで回す。
 * @returns 最終回答＋実行ステップ（監査・UI 表示用）
 */
export async function runAgent(opts: {
  message: string
  tools: AgentTool[]
  complete: CompleteFn
  maxSteps?: number
}): Promise<AgentResult> {
  const { message, tools, complete } = opts
  const maxSteps = opts.maxSteps ?? 5
  const system = buildAgentSystem(tools)
  const byName = new Map(tools.map((t) => [t.name, t]))
  const steps: AgentStep[] = []
  let transcript = `ユーザーの依頼: ${message}`

  for (let i = 0; i < maxSteps; i++) {
    const text = await complete(system, transcript)
    const action = parseAgentAction(text)
    if (!action) {
      // JSON で返らない＝説明文をそのまま回答とみなす（安全側）
      return { answer: text.trim() || '（応答を解釈できませんでした）', steps }
    }
    if (action.action === 'final') {
      return { answer: action.answer || '（回答が空でした）', steps }
    }
    const tool = byName.get(action.tool)
    if (!tool) {
      const msg = `不明なツール: ${action.tool}`
      steps.push({ kind: 'error', message: msg })
      transcript += `\nアシスタント: ${text}\nツール結果: ${JSON.stringify({ error: msg })}`
      continue
    }
    let result: unknown
    try {
      result = await tool.run(action.args)
    } catch (e) {
      result = { error: e instanceof Error ? e.message : String(e) }
    }
    steps.push({ kind: 'tool', tool: action.tool, args: action.args, result })
    transcript += `\nアシスタント: ${text}\nツール結果(${action.tool}): ${JSON.stringify(result).slice(0, 4000)}`
  }

  // 上限到達：これまでの観測だけで最終回答を促す1回（無限ループ防止）
  const finalText = await complete(
    `${system}\n（ステップ上限に達しました。これまでのツール結果だけで日本語の最終回答を {"action":"final","answer":"..."} の形で返してください）`,
    transcript,
  )
  const parsed = parseAgentAction(finalText)
  return {
    answer: parsed?.action === 'final' && parsed.answer ? parsed.answer : finalText.trim() || '（情報を十分に集められませんでした）',
    steps,
  }
}
