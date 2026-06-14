'use client'

/**
 * ToDo 完了チェックの楽観的トグル（perceived performance / #40 Sprint 3+）。
 *
 * 背景: 従来は <form action={serverAction}> の素のボタンで、押してから
 * server action（DB更新 + revalidatePath による画面再取得）が往復する数秒間、
 * 画面に一切フィードバックが無く「押しても無反応」に見えた。
 *
 * 対策: クリックした瞬間にチェック状態をローカルで反映（楽観的更新）し、
 * server action は useTransition で裏で実行。失敗時は元に戻す。
 * revalidate 完了で done prop が更新されたら useEffect で同期（最終的真実はサーバ）。
 *
 * 既存の inline server action（formData を読む）をそのまま action prop で受け取り、
 * クリック時に FormData(id, done) を組み立てて呼ぶ。
 */
import { useState, useEffect, useTransition } from 'react'
import { Loader2, Check } from 'lucide-react'

export default function TaskDoneToggle({
  taskId,
  done,
  action,
  className = '',
}: {
  taskId: string
  done: boolean
  action: (formData: FormData) => Promise<void>
  className?: string
}) {
  const [optimistic, setOptimistic] = useState(done)
  const [pending, startTransition] = useTransition()

  // revalidate 後にサーバの値が変わったら同期（楽観値とズレていれば合わせる）
  useEffect(() => {
    setOptimistic(done)
  }, [done])

  function handleClick() {
    const next = !optimistic
    setOptimistic(next) // 押した瞬間に見た目を反映
    const fd = new FormData()
    fd.set('id', taskId)
    fd.set('done', String(next))
    startTransition(async () => {
      try {
        await action(fd)
      } catch {
        setOptimistic(!next) // 失敗時は元に戻す
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={optimistic}
      title={optimistic ? '未完了に戻す' : '完了にする'}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        optimistic ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 hover:border-blue-400'
      } ${pending ? 'opacity-70 cursor-wait' : ''} ${className}`}
    >
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
      ) : optimistic ? (
        <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
      ) : null}
    </button>
  )
}
