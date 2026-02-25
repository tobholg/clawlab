import { getHeader, type H3Event } from 'h3'
import { prisma } from './prisma'

export type AgentContextUser = {
  id: string
  email: string
  name: string | null
  avatar: string | null
  isAgent: boolean
  agentProvider: string | null
}

export function requireAgentUser(event: H3Event): AgentContextUser {
  const agentUser = (event.context as { agentUser?: AgentContextUser }).agentUser
  if (!agentUser || !agentUser.isAgent) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return agentUser
}

export async function requireTokenUser(event: H3Event): Promise<AgentContextUser> {
  const contextUser = (event.context as { agentUser?: AgentContextUser }).agentUser
  if (contextUser) {
    return contextUser
  }

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid API key' })
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey.startsWith('ctx_')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid API key' })
  }

  const user = await prisma.user.findUnique({
    where: { apiToken: apiKey },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isAgent: true,
      agentProvider: true,
    },
  })

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  return user
}

export async function requireAssignedProject(agentUserId: string, projectId: string) {
  const project = await prisma.item.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      parentId: true,
      title: true,
      description: true,
      status: true,
      progress: true,
    },
  })

  if (!project || project.parentId !== null) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const assignment = await prisma.itemAssignment.findUnique({
    where: {
      itemId_userId: {
        itemId: projectId,
        userId: agentUserId,
      },
    },
    select: { id: true },
  })

  if (!assignment) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  return project
}

export async function requireAssignedTask(agentUserId: string, taskId: string) {
  const task = await prisma.item.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      workspaceId: true,
      parentId: true,
      projectId: true,
      ownerId: true,
      itemType: true,
      status: true,
      subStatus: true,
      progress: true,
      startDate: true,
      agentMode: true,
      planDocId: true,
      acceptedPlanVersion: true,
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  const assignment = await prisma.itemAssignment.findUnique({
    where: {
      itemId_userId: {
        itemId: taskId,
        userId: agentUserId,
      },
    },
    select: { id: true },
  })

  if (!assignment) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  return task
}

export function getDisplayName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split('@')[0]
}
