/**
 * 統一アシスタント（エージェント）の型（REQ-0088 / ADR-0032）。
 * provider 非依存・テスト容易性のため、モデル補完は CompleteFn として注入する。
 */

/** Agent が使える型付きツール。PoC は読み取り専用（draft-then-apply を自明に満たす）。 */
export type AgentTool = {
  name: string
  description: string
  /** 引数のヒント（プロンプトに提示。例: '{ query: string }'） */
  args: string
  /** 実行。戻り値は JSON 化してモデルに観測として戻す。RBAC は run 内で満たす。 */
  run: (args: Record<string, unknown>) => Promise<unknown>
}

/** モデルが返す行動（厳密 JSON をパースしたもの）。 */
export type AgentAction =
  | { action: 'tool'; tool: string; args: Record<string, unknown> }
  | { action: 'final'; answer: string }

export type AgentStep =
  | { kind: 'tool'; tool: string; args: Record<string, unknown>; result: unknown }
  | { kind: 'error'; message: string }

export type AgentResult = { answer: string; steps: AgentStep[] }

/** 注入可能なモデル補完：system + user(=これまでの会話) → テキスト。 */
export type CompleteFn = (system: string, user: string) => Promise<string>
