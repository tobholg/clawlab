import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')
  const updateId = getRouterParam(event, 'updateId')

  if (!spaceId || !spaceSlug || !updateId) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID, slug, and update ID are required' })
  }

  const update = await prisma.spaceUpdate.findUnique({
    where: { id: updateId },
    include: {
      externalSpace: {
        select: {
          id: true,
          slug: true,
          archived: true,
          project: { select: { workspaceId: true } },
        },
      },
    },
  })

  if (!update || update.externalSpace.archived || update.externalSpace.id !== spaceId || update.externalSpace.slug !== spaceSlug) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: update.externalSpace.project.workspaceId },
    select: { organizationId: true },
  })

  const [workspaceMembership, orgMembership] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: update.externalSpace.project.workspaceId,
          userId: user.id,
        },
      },
      select: { status: true },
    }),
    prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: user.id,
        },
      },
      select: { status: true },
    }),
  ])

  const isActiveWorkspaceMember = workspaceMembership?.status === 'ACTIVE'
  const isActiveOrgMember = orgMembership?.status === 'ACTIVE'

  if (!isActiveWorkspaceMember && !isActiveOrgMember) {
    throw createError({ statusCode: 403, statusMessage: 'Only team members can manage updates' })
  }

  await prisma.spaceUpdate.delete({ where: { id: updateId } })

  return { success: true }
})
