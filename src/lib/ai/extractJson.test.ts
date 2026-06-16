/**
 * extractJson / extractJsonObject の単体テスト（REQ-0082）。
 * LLM 応答にありがちな包み方（フェンス・前後の地の文・配列）を頑健に解釈できることを検証。
 */
import { describe, it, expect } from 'vitest'
import { extractJson, extractJsonObject } from './extractJson'

describe('extractJson', () => {
  it('素の JSON オブジェクト', () => {
    expect(extractJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })
  it('```json フェンスを剥がす', () => {
    const text = 'はい、以下が結果です。\n```json\n{"a":1}\n```\nご確認ください。'
    expect(extractJson(text)).toEqual({ a: 1 })
  })
  it('言語指定なしフェンス', () => {
    expect(extractJson('```\n{"ok":true}\n```')).toEqual({ ok: true })
  })
  it('前後に地の文がある裸のオブジェクト', () => {
    expect(extractJson('結果: {"n":42} 以上')).toEqual({ n: 42 })
  })
  it('配列を取り出す', () => {
    expect(extractJson('```json\n[{"i":1},{"i":2}]\n```')).toEqual([{ i: 1 }, { i: 2 }])
  })
  it('解釈不能なら null', () => {
    expect(extractJson('JSON はありません')).toBeNull()
    expect(extractJson('')).toBeNull()
  })
  it('壊れた JSON は null', () => {
    expect(extractJson('{"a":}')).toBeNull()
  })
})

describe('extractJsonObject', () => {
  it('オブジェクトはそのまま', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('配列は弾いて null', () => {
    expect(extractJsonObject('[1,2,3]')).toBeNull()
  })
  it('スカラー/解釈不能は null', () => {
    expect(extractJsonObject('42')).toBeNull()
    expect(extractJsonObject('なし')).toBeNull()
  })
})
