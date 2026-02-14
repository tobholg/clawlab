import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
  }

  // Find space
  const space = await prisma.externalSpace.findFirst({
    where: { id: spaceId, slug: spaceSlug, archived: false },
    include: {
      project: { select: { workspaceId: true } },
    },
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Check if user is a team member (workspace member OR org member)
  let isTeamMember = false
  const ws = await prisma.workspace.findUnique({
    where: { id: space.project.workspaceId },
    select: { organizationId: true },
  })
  if (ws) {
    const [wsMembership, orgMembership] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: space.project.workspaceId,
            userId: user.id,
          },
        },
        select: { status: true },
      }),
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ws.organizationId,
            userId: user.id,
          },
        },
        select: { status: true },
      }),
    ])
    isTeamMember = wsMembership?.status === 'ACTIVE' || orgMembership?.status === 'ACTIVE'
  }

  // Check if user is a stakeholder
  if (!isTeamMember) {
    const stakeholderAccess = await prisma.stakeholderAccess.findUnique({
      where: {
        userId_externalSpaceId: {
          userId: user.id,
          externalSpaceId: space.id,
        },
      },
    })

    if (!stakeholderAccess) {
      throw createError({ statusCode: 403, statusMessage: 'You do not have access to this space' })
    }
  }

  // Stakeholders only see PUBLISHED, team members also see DRAFT
  const statusFilter = isTeamMember
    ? { in: ['DRAFT', 'PUBLISHED'] as const }
    : 'PUBLISHED' as const

  const updates = await prisma.spaceUpdate.findMany({
    where: {
      externalSpaceId: space.id,
      status: statusFilter,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      risks: true,
      wins: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      generatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return updates
})
