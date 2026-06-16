import { db } from '@/lib/db'
import { accounts } from '@/lib/schema'
import { projects } from '@/industries/real-estate/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ProjectForm from '@/industries/real-estate/components/ProjectForm'
import { updateProject } from '@/industries/real-estate/actions/projects'
import { getAllUsers } from '@/lib/userUtils'
import { requireEditor } from '@/lib/auth'
import type { CreateState } from '@/lib/duplicateTypes'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEditor()
  const { id } = await params
  const [project, accountsList, users] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)).then((r) => r[0] ?? null),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts).where(eq(accounts.status, 'active')).orderBy(asc(accounts.name)),
    getAllUsers(),
  ])
  if (!project) notFound()

  async function action(_: CreateState, formData: FormData): Promise<CreateState> {
    'use server'
    try {
      await updateProject(id, formData)
      return null
    } catch (e) {
      if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
      return { kind: 'error', message: (e as Error).message }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="text-sm text-zinc-400 mb-4">
        <Link href="/projects" className="hover:text-zinc-600">プロジェクト</Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${id}`} className="hover:text-zinc-600">{project.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">編集</span>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">プロジェクトを編集</h1>
      <ProjectForm
        action={action}
        cancelHref={`/projects/${id}`}
        accounts={accountsList}
        users={users}
        defaultValues={{
          name: project.name, status: project.status, project_type: project.project_type,
          account_id: project.account_id, location: project.location,
          start_date: project.start_date ? String(project.start_date).slice(0, 10) : '',
          end_date: project.end_date ? String(project.end_date).slice(0, 10) : '',
          budget: project.budget, expected_revenue: project.expected_revenue, actual_cost: project.actual_cost,
          description: project.description, owner_id: project.owner_id,
        }}
      />
    </div>
  )
}
