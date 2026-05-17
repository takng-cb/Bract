/**
 * 損傷マップ関連の型・定数。
 *
 * `'use server'` ファイル（actions/maintenanceDamagePins.ts）からは
 * async 関数しか export できないため、型と定数はこちらに分離する。
 */

export type DamageView = 'top' | 'front' | 'back' | 'left' | 'right'
export type DamageCategory = '凹み' | '擦り傷' | '塗装剥がれ' | '破損' | 'サビ' | 'その他'
export type DamageSeverity = '軽' | '中' | '大'

export const DAMAGE_VIEWS: { value: DamageView; label: string }[] = [
  { value: 'top',   label: '俯瞰図' },
  { value: 'front', label: '前面' },
  { value: 'back',  label: '後面' },
  { value: 'left',  label: '左側面' },
  { value: 'right', label: '右側面' },
]

export const DAMAGE_CATEGORIES: DamageCategory[] = ['凹み', '擦り傷', '塗装剥がれ', '破損', 'サビ', 'その他']
export const DAMAGE_SEVERITIES: DamageSeverity[] = ['軽', '中', '大']
