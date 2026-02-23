import { prisma } from '../../utils/prisma'
import { requireTokenUser } from '../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)

  const projects = await prisma.item.findMany({
    where: {
      parentId: null,
      assignees: { some: { userId: agent.id } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      progress: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!projects.length) {
    return []
  }

  const projectIds = projects.map((project) => project.id)
  const taskCounts = await prisma.item.groupBy({
    by: ['projectId', 'status'],
    where: {
      projectId: { in: projectIds },
    },
    _count: { _all: true },
  })

  const countsByProject = new Map<string, { todo: number; inProgress: number; done: number }>()
  for (const projectId of projectIds) {
    countsByProject.set(projectId, { todo: 0, inProgress: 0, done: 0 })
  }

  for (const row of taskCounts) {
    if (!row.projectId) continue
    const counts = countsByProject.get(row.projectId)
    if (!counts) continue

    if (row.status === 'TODO') {
      counts.todo += row._count._all
    } else if (row.status === 'DONE') {
      counts.done += row._count._all
    } else {
      counts.inProgress += row._count._all
    }
  }

  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    progress: project.progress,
    taskCount: countsByProject.get(project.id) ?? { todo: 0, inProgress: 0, done: 0 },
  }))
})
