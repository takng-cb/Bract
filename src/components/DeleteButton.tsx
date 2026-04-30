'use client'

type Props = {
  action: () => Promise<void>
  confirmMessage?: string
  label?: string
}

export default function DeleteButton({
  action,
  confirmMessage = '本当に削除しますか？',
  label = '削除',
}: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault()
      }}
    >
      <button
        type="submit"
        className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 transition-colors"
      >
        {label}
      </button>
    </form>
  )
}
