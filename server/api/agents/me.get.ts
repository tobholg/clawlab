import { prisma } from '../../utils/prisma'
import { requireAgentUser } from '../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const agent = requireAgentUser(event)

  const [projects, planTasks, executeTasks, reviewTasks] = await Promise.all([
    prisma.itemAssignment.count({
      where: {
        userId: agent.id,
        item: { parentId: null },
      },
    }),
    prisma.itemAssignment.count({
      where: {
        userId: agent.id,
        item: {
          parentId: { not: null },
          status: { not: 'DONE' },
          agentMode: 'PLAN',
        },
      },
    }),
    prisma.itemAssignment.count({
      where: {
        userId: agent.id,
        item: {
          parentId: { not: null },
          status: { not: 'DONE' },
          agentMode: 'EXECUTE',
        },
      },
    }),
    prisma.itemAssignment.count({
      where: {
        userId: agent.id,
        item: {
          parentId: { not: null },
          status: { not: 'DONE' },
          subStatus: 'review',
        },
      },
    }),
  ])

  return {
    id: agent.id,
    name: agent.name ?? agent.email.split('@')[0],
    agentProvider: agent.agentProvider,
    projects,
    tasks: {
      plan: planTasks,
      execute: executeTasks,
      review: reviewTasks,
    },
  }
})
