import { defineEventHandler, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  // Get all spaces where user has stakeholder access
  const stakeholderAccess = await prisma.stakeholderAccess.findMany({
    where: {
      userId: user.id,
      externalSpace: {
        archived: false
      }
    },
    include: {
      externalSpace: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true
            }
          }
        }
      }
    },
    orderBy: {
      invitedAt: 'desc'
    }
  })

  // Get stats for each space
  const spacesWithStats = await Promise.all(
    stakeholderAccess.map(async (access) => {
      // Count pending IRs in this space
      const pendingIRs = await prisma.informationRequest.count({
        where: {
          externalSpaceId: access.externalSpaceId,
          status: 'PENDING'
        }
      })

      // Count user's own requests (IRs + external tasks)
      const myIRs = await prisma.informationRequest.count({
        where: {
          externalSpaceId: access.externalSpaceId,
          createdById: user.id
        }
      })

      const myTasks = await prisma.externalTask.count({
        where: {
          externalSpaceId: access.externalSpaceId,
          submittedById: user.id
        }
      })

      return {
        id: access.externalSpace.id,
        name: access.externalSpace.name,
        slug: access.externalSpace.slug,
        description: access.externalSpace.description,
        project: {
          id: access.externalSpace.project.id,
          title: access.externalSpace.project.title,
          description: access.externalSpace.project.description
        },
        stats: {
          pendingIRs,
          myRequests: myIRs + myTasks
        },
        joinedAt: access.invitedAt.toISOString(),
        displayName: access.displayName,
        position: access.position
      }
    })
  )

  return spacesWithStats
})
