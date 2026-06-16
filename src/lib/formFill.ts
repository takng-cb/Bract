/**
 * 非制御フォームの input/textarea/select/radio に値を流し込む DOM ユーティリティ。
 * React の uncontrolled 入力に「ネイティブ setter ＋ input/change イベント」で反映する。
 * FormFillModal（テキストから入力）と PlaudImportButton（PLAUD 取り込み）で共用。
 */
export function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** form 内の name 一致の要素へ値を適用（radio はその value を選択）。 */
export function applyField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name)
  if (!el) return
  if (el instanceof RadioNodeList) {
    el.value = value
    return
  }
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    setNativeValue(el, value)
  }
}
