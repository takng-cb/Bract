'use client'

type Props = {
  userId: string
  currentRole: string
  updateAction: (formData: FormData) => Promise<void>
}

export default function RoleSelect({ userId, currentRole, updateAction }: Props) {
  return (
    <form action={updateAction}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={(e) => (e.target.form as HTMLFormElement).requestSubmit()}
        className="border border-zinc-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="admin">管理者</option>
        <option value="editor">編集者</option>
        <option value="viewer">閲覧者</option>
      </select>
    </form>
  )
}
