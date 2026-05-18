/**
 * 顧客（取引先 + 顧客担当者）の表示ロジック。
 *
 * 板金業では BtoB（法人）と BtoC（個人）の両方の顧客がいる。
 * - BtoB: 取引先（会社名）を持ち、その下に窓口担当者が存在する
 * - BtoC: 取引先は持たず、本人が顧客そのもの
 *
 * ただし DB スキーマでは account_id が必須のため、BtoC ケースでは
 * 「個人」というプレースホルダ取引先を作成してそこに紐付ける運用にしている。
 * 表示時には「個人」を実質的に空（取引先なし）として扱う。
 */

/** 「個人」プレースホルダ取引先の名前。表示時にはこれを空扱いにする。 */
export const PERSONAL_ACCOUNT_NAME = '個人'

/**
 * その取引先が「個人」プレースホルダ（実質 BtoC）かどうか。
 * account が null/undefined のときも個人扱い。
 */
export function isPersonalAccount(
  account: { name?: string | null } | null | undefined,
): boolean {
  if (!account) return true
  return !account.name || account.name.trim() === '' || account.name === PERSONAL_ACCOUNT_NAME
}

/**
 * UI 上で顧客を 1 行で表すときの主表示名を返す。
 * - 取引先が実体ある会社: その会社名
 * - 個人/未設定: 顧客担当者の氏名（無ければ「—」）
 */
export function customerPrimaryName(
  account: { name?: string | null } | null | undefined,
  contact: { full_name?: string | null } | null | undefined,
): string {
  if (!isPersonalAccount(account)) return account!.name ?? '—'
  return contact?.full_name ?? '—'
}

/**
 * 表示用に整形した取引先名。「個人」は空文字に変換する。
 * 編集モーダルのドロップダウン表示などで利用。
 */
export function accountDisplayName(
  account: { name?: string | null } | null | undefined,
): string {
  if (isPersonalAccount(account)) return ''
  return account!.name ?? ''
}
