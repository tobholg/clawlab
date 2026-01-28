import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          userId: user.id
        }
      }
    },
    include: {
      _count: {
        select: { tasks: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return { projects }
})
