import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'
import { getDefaultSubStatus } from '../../../../utils/itemStage'

type ProposedTask = {
  title: string
  description?: string | null
  children?: ProposedTask[]
}

type TaskProposal = {
  parentTitle: string
  projectId: string | null
  tasks: ProposedTask[]
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const channelId = getRouterParam(event, 'id')
  const body = await readBody<{ proposal?: TaskProposal }>(event)

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const proposal = body?.proposal
  if (!proposal) {
    throw createError({ statusCode: 400, message: 'proposal is required' })
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true, projectId: true },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  const parentTitle = typeof proposal.parentTitle === 'string' ? proposal.parentTitle.trim() : ''
  if (!parentTitle) {
    throw createError({ statusCode: 400, message: 'proposal.parentTitle is required' })
  }

  const tasks = Array.isArray(proposal.tasks) ? normalizeTasks(proposal.tasks) : []
  if (tasks.length === 0) {
    throw createError({ statusCode: 400, message: 'proposal.tasks is required' })
  }

  const projectId = proposal.projectId || channel.projectId
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'projectId is required to accept tasks' })
  }

  const project = await prisma.item.findFirst({
    where: { id: projectId, workspaceId: channel.workspaceId, parentId: null },
    select: { id: true },
  })

  if (!project) {
    throw createError({ statusCode: 400, message: 'Project not found for this workspace' })
  }

  const parentItem = await createItem({
    workspaceId: channel.workspaceId,
    parentId: project.id,
    title: parentTitle,
    description: null,
  })

  for (const task of tasks) {
    await createTaskTree({
      workspaceId: channel.workspaceId,
      parentId: parentItem.id,
      task,
    })
  }

  return { parentId: parentItem.id }
})

async function createTaskTree(params: { workspaceId: string; parentId: string; task: ProposedTask }) {
  const item = await createItem({
    workspaceId: params.workspaceId,
    parentId: params.parentId,
    title: params.task.title,
    description: params.task.description ?? null,
  })

  if (params.task.children && params.task.children.length > 0) {
    for (const child of params.task.children) {
      await createTaskTree({
        workspaceId: params.workspaceId,
        parentId: item.id,
        task: child,
      })
    }
  }
}

async function createItem(params: { workspaceId: string; parentId: string | null; title: string; description: string | null }) {
  let projectId: string | null = null

  if (params.parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: params.parentId },
      select: { projectId: true },
    })
    projectId = parent?.projectId ?? params.parentId
  }

  return prisma.item.create({
    data: {
      workspaceId: params.workspaceId,
      parentId: params.parentId,
      projectId,
      title: params.title,
      description: params.description,
      status: 'TODO',
      subStatus: getDefaultSubStatus('TODO'),
    },
    select: { id: true },
  })
}

function normalizeTasks(tasks: ProposedTask[]): ProposedTask[] {
  return tasks
    .map(task => ({
      title: typeof task.title === 'string' ? task.title.trim() : '',
      description: typeof task.description === 'string' ? task.description.trim() : undefined,
      children: Array.isArray(task.children) ? normalizeTasks(task.children) : undefined,
    }))
    .filter(task => task.title.length > 0)
}
