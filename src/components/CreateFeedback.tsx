'use client'

/**
 * 新規作成フォーム共通フィードバック（REQ-0018 / ADR-0013）
 *
 * create アクションの戻り値 `CreateState` を受けて、
 *  - error    → 赤帯メッセージ
 *  - duplicate → 「既存を開く / それでも新規作成」確認パネル
 * を描画する。常に hidden 入力 `__allow_duplicate` をフォームに供給し、
 * 「それでも新規作成」押下時は値を 1 にしてフォームを再送信（＝検査スキップ）する。
 *
 * フォーム側は `<form ref={formRef} action={formAction}>` の直下にこれを置くだけでよい。
 */
import Link from 'next/link'
import { useRef, type RefObject } from 'react'
import type { CreateState } from '@/lib/duplicateTypes'

export default function CreateFeedback({
  state,
  formRef,
}: {
  state: CreateState
  formRef: RefObject<HTMLFormElement | null>
}) {
  const hiddenRef = useRef<HTMLInputElement>(null)

  const createAnyway = () => {
    if (hiddenRef.current) hiddenRef.current.value = '1'
    formRef.current?.requestSubmit()
  }

  return (
    <>
      <input ref={hiddenRef} type="hidden" name="__allow_duplicate" defaultValue="" />

      {state?.kind === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md whitespace-pre-wrap">
          {state.message}
        </div>
      )}

      {state?.kind === 'duplicate' && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">同じ{state.objectLabel}が既に登録されています</p>
            <p className="text-xs text-amber-700 mt-0.5">
              重複を避けるため、既存のレコードを開くか、それでも新規作成するかを選んでください。
            </p>
          </div>
          <ul className="space-y-1.5">
            {state.candidates.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className="block rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  ✓ 既存の「{c.label}」を開く
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={createAnyway}
            className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            それでも新規作成する
          </button>
        </div>
      )}
    </>
  )
}
