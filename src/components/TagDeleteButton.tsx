'use client'

type Props = {
  tagId: string
  tagName: string
  action: (formData: FormData) => Promise<void>
}

export default function TagDeleteButton({ tagId, tagName, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={tagId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`「${tagName}」を削除しますか？`)) e.preventDefault()
        }}
        className="text-xs text-red-400 hover:text-red-600"
      >
        削除
      </button>
    </form>
  )
}
