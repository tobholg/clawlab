import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
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

  const body = await readBody<{
    action: 'publish' | 'discard' | 'edit'
    title?: string
    summary?: string
    wins?: Array<{ text: string }>
    risks?: Array<{ text: string }>
  }>(event)

  if (!body.action || !['publish', 'discard', 'edit'].includes(body.action)) {
    throw createError({ statusCode: 400, statusMessage: 'Action must be "publish", "discard", or "edit"' })
  }

  // Find the update by ID (globally unique) and load its space + project chain
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

  // Get workspace to find organizationId
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: update.externalSpace.project.workspaceId },
    select: { organizationId: true },
  })

  // Verify user is an internal team member: active workspace member OR active org member
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

  if (body.action === 'edit') {
    if (!body.title?.trim() || !body.summary?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Title and summary are required' })
    }
    if (body.wins && (!Array.isArray(body.wins) || body.wins.some((w: any) => typeof w.text !== 'string'))) {
      throw createError({ statusCode: 400, statusMessage: 'Wins must be an array of { text: string }' })
    }
    if (body.risks && (!Array.isArray(body.risks) || body.risks.some((r: any) => typeof r.text !== 'string'))) {
      throw createError({ statusCode: 400, statusMessage: 'Risks must be an array of { text: string }' })
    }

    const updated = await prisma.spaceUpdate.update({
      where: { id: updateId },
      data: {
        title: body.title.trim(),
        summary: body.summary.trim(),
        ...(body.wins !== undefined && { wins: body.wins }),
        ...(body.risks !== undefined && { risks: body.risks }),
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
    })

    return updated
  }

  // publish / discard — only allowed on drafts
  if (update.status !== 'DRAFT') {
    throw createError({ statusCode: 400, statusMessage: 'Only draft updates can be published or discarded' })
  }

  const updated = await prisma.spaceUpdate.update({
    where: { id: updateId },
    data: {
      status: body.action === 'publish' ? 'PUBLISHED' : 'DISCARDED',
      publishedAt: body.action === 'publish' ? new Date() : undefined,
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
  })

  return updated
})
