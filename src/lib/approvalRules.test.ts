import { describe, it, expect } from 'vitest'
import {
  parseApprovalConfig,
  evaluateCondition,
  matchRule,
  findRoute,
  approverMatches,
  canDecideStep,
  isStepSatisfied,
  type ApprovalConfig,
  type ApprovalStep,
} from './approvalRules'

describe('parseApprovalConfig', () => {
  it('正しい JSON をパースできる', () => {
    const raw = JSON.stringify({ enabled: true, rules: [{ steps: [{ approvers: ['role:admin'], mode: 'any' }] }] })
    const c = parseApprovalConfig(raw)
    expect(c?.enabled).toBe(true)
    expect(c?.rules).toHaveLength(1)
  })

  it('null / 空 / 不正 JSON / 形式違いは null', () => {
    expect(parseApprovalConfig(null)).toBeNull()
    expect(parseApprovalConfig('')).toBeNull()
    expect(parseApprovalConfig('{bad')).toBeNull()
    expect(parseApprovalConfig(JSON.stringify({ enabled: 'yes' }))).toBeNull()
    expect(parseApprovalConfig(JSON.stringify({ enabled: true }))).toBeNull()
  })
})

describe('evaluateCondition', () => {
  const rec = { amount: '150000', category: '接待費', title: '会食代' }

  it('数値比較（>= > <= < = !=）', () => {
    expect(evaluateCondition({ field: 'amount', op: '>=', value: '100000' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'amount', op: '>=', value: '150000' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'amount', op: '>',  value: '150000' }, rec)).toBe(false)
    expect(evaluateCondition({ field: 'amount', op: '<',  value: '200000' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'amount', op: '=',  value: '150000' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'amount', op: '!=', value: '150000' }, rec)).toBe(false)
  })

  it('文字列比較（= != contains）', () => {
    expect(evaluateCondition({ field: 'category', op: '=',  value: '接待費' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'category', op: '!=', value: '交通費' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'title', op: 'contains', value: '会食' }, rec)).toBe(true)
    expect(evaluateCondition({ field: 'title', op: 'contains', value: '出張' }, rec)).toBe(false)
  })

  it('フィールド欠落 / null は false', () => {
    expect(evaluateCondition({ field: 'missing', op: '=', value: 'x' }, rec)).toBe(false)
    expect(evaluateCondition({ field: 'amount', op: '>=', value: '1' }, { amount: null })).toBe(false)
  })

  it('非数値どうしの大小比較は false（暗黙の文字列比較をしない）', () => {
    expect(evaluateCondition({ field: 'category', op: '>=', value: 'あ' }, rec)).toBe(false)
  })
})

describe('matchRule / findRoute', () => {
  const steps: ApprovalStep[] = [{ approvers: ['role:admin'], mode: 'any' }]

  it('when 省略は無条件マッチ', () => {
    expect(matchRule({ steps }, { amount: '1' })).toBe(true)
  })

  it('all は全条件、any はいずれか', () => {
    const rec = { amount: '200000', category: '接待費' }
    expect(matchRule({ when: { all: [
      { field: 'amount', op: '>=', value: '100000' },
      { field: 'category', op: '=', value: '接待費' },
    ] }, steps }, rec)).toBe(true)
    expect(matchRule({ when: { all: [
      { field: 'amount', op: '>=', value: '300000' },
      { field: 'category', op: '=', value: '接待費' },
    ] }, steps }, rec)).toBe(false)
    expect(matchRule({ when: { any: [
      { field: 'amount', op: '>=', value: '300000' },
      { field: 'category', op: '=', value: '接待費' },
    ] }, steps }, rec)).toBe(true)
  })

  it('findRoute: 無効設定 / マッチ無し / steps 空は null', () => {
    const config: ApprovalConfig = {
      enabled: true,
      rules: [{ when: { all: [{ field: 'amount', op: '>=', value: '100000' }] }, steps }],
    }
    expect(findRoute(config, { amount: '200000' })).toEqual(steps)
    expect(findRoute(config, { amount: '50000' })).toBeNull()
    expect(findRoute({ ...config, enabled: false }, { amount: '200000' })).toBeNull()
    expect(findRoute(null, { amount: '200000' })).toBeNull()
    expect(findRoute({ enabled: true, rules: [{ steps: [] }] }, {})).toBeNull()
  })

  it('findRoute: 上から評価し最初のマッチを採用', () => {
    const bigSteps: ApprovalStep[] = [{ approvers: ['user:boss'], mode: 'any' }, { approvers: ['role:admin'], mode: 'any' }]
    const config: ApprovalConfig = {
      enabled: true,
      rules: [
        { when: { all: [{ field: 'amount', op: '>=', value: '500000' }] }, steps: bigSteps },
        { when: { all: [{ field: 'amount', op: '>=', value: '100000' }] }, steps },
      ],
    }
    expect(findRoute(config, { amount: '600000' })).toEqual(bigSteps)
    expect(findRoute(config, { amount: '200000' })).toEqual(steps)
  })
})

describe('approverMatches / canDecideStep / isStepSatisfied', () => {
  const step: ApprovalStep = { approvers: ['user:u1', 'role:admin'], mode: 'any' }

  it('user: / role: の合致', () => {
    expect(approverMatches('user:u1', 'u1', 'editor')).toBe(true)
    expect(approverMatches('user:u1', 'u2', 'editor')).toBe(false)
    expect(approverMatches('role:admin', 'u9', 'admin')).toBe(true)
    expect(approverMatches('role:admin', 'u9', 'editor')).toBe(false)
  })

  it('canDecideStep: 承認者のみ・同 step 判定済みは不可', () => {
    expect(canDecideStep(step, 1, [], 'u1', 'editor')).toBe(true)
    expect(canDecideStep(step, 1, [], 'u9', 'admin')).toBe(true)
    expect(canDecideStep(step, 1, [], 'u9', 'editor')).toBe(false)
    expect(canDecideStep(step, 1, [{ step: 1, approver_id: 'u1', decision: 'approved' }], 'u1', 'editor')).toBe(false)
    // 別 step の判定は妨げない
    expect(canDecideStep(step, 2, [{ step: 1, approver_id: 'u1', decision: 'approved' }], 'u1', 'editor')).toBe(true)
  })

  it('isStepSatisfied: any は1承認、all は全エントリ充足', () => {
    const anyStep: ApprovalStep = { approvers: ['user:u1', 'user:u2'], mode: 'any' }
    const allStep: ApprovalStep = { approvers: ['user:u1', 'role:admin'], mode: 'all' }

    expect(isStepSatisfied(anyStep, 1, [{ step: 1, approver_id: 'u1', decision: 'approved' }], {})).toBe(true)
    expect(isStepSatisfied(anyStep, 1, [{ step: 1, approver_id: 'u1', decision: 'rejected' }], {})).toBe(false)

    const roles = { u1: 'editor', u9: 'admin' }
    expect(isStepSatisfied(allStep, 1, [{ step: 1, approver_id: 'u1', decision: 'approved' }], roles)).toBe(false)
    expect(isStepSatisfied(allStep, 1, [
      { step: 1, approver_id: 'u1', decision: 'approved' },
      { step: 1, approver_id: 'u9', decision: 'approved' },
    ], roles)).toBe(true)
  })
})
