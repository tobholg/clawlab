import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const query = getQuery(event)

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
  }

  // Optional filters
  const spaceId = query.spaceId as string | undefined
  const type = query.type as 'task' | 'question' | 'suggestion' | undefined
  const status = query.status as string | undefined

  // Verify user has access to this project (is a member of the workspace)
  const project = await prisma.item.findFirst({
    where: {
      id: projectId,
      parentId: null, // Root item = project
      workspace: {
        members: {
          some: { userId: user.id }
        }
      }
    },
    select: { id: true, workspaceId: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Build where clause for spaces
  const spaceWhere: any = {
    projectId,
    archived: false,
  }
  if (spaceId) {
    spaceWhere.id = spaceId
  }

  // Get all external spaces for this project
  const spaces = await prisma.externalSpace.findMany({
    where: spaceWhere,
    select: { id: true, name: true, slug: true }
  })

  const spaceIds = spaces.map(s => s.id)
  const spaceMap = new Map(spaces.map(s => [s.id, s]))

  // Build tasks query
  const taskWhere: any = {
    externalSpaceId: { in: spaceIds },
  }
  
  // Filter by type - if type is 'task', include all tasks; if question/suggestion, exclude tasks
  if (type === 'task') {
    // Only include tasks (handled below)
  } else if (type === 'question' || type === 'suggestion') {
    // Will exclude tasks entirely
    taskWhere.id = { equals: 'never-match' } // Hacky way to return no tasks
  }
  
  // Status filter for tasks
  if (status === 'pending' || !status) {
    // Default: show PENDING and NEEDS_INFO
    taskWhere.status = { in: ['PENDING', 'NEEDS_INFO'] }
  } else if (status === 'resolved') {
    // Show accepted/rejected
    taskWhere.status = { in: ['ACCEPTED', 'REJECTED'] }
  } else if (status === 'all') {
    // No status filter - show all
  } else if (type !== 'question' && type !== 'suggestion') {
    taskWhere.status = status.toUpperCase()
  }

  // Get external tasks (unless filtering by question/suggestion type)
  let externalTasks: any[] = []
  if (type !== 'question' && type !== 'suggestion') {
    externalTasks = await prisma.externalTask.findMany({
      where: taskWhere,
      include: {
        submittedBy: {
          select: { id: true, name: true, email: true }
        },
        externalComments: {
          include: {
            author: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        externalSpace: {
          include: {
            stakeholderAccess: {
              where: {
                userId: undefined // Will be filled per task
              },
              select: {
                displayName: true,
                position: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get stakeholder info for each task's submitter
    for (const task of externalTasks) {
      const stakeholderAccess = await prisma.stakeholderAccess.findFirst({
        where: {
          userId: task.submittedById,
          externalSpaceId: task.externalSpaceId
        },
        select: { displayName: true, position: true }
      })
      task.submitterInfo = {
        displayName: stakeholderAccess?.displayName || task.submittedBy.name || task.submittedBy.email,
        position: stakeholderAccess?.position
      }
    }
  }

  // Build IR query
  const irWhere: any = {
    externalSpaceId: { in: spaceIds },
  }
  
  // Filter by type
  if (type === 'question') {
    irWhere.type = 'QUESTION'
  } else if (type === 'suggestion') {
    irWhere.type = 'SUGGESTION'
  } else if (type === 'task') {
    // Exclude IRs when filtering by task
    irWhere.id = { equals: 'never-match' }
  }
  
  // Status filter for IRs
  if (status === 'pending' || !status) {
    // Default: show PENDING
    irWhere.status = 'PENDING'
  } else if (status === 'resolved') {
    // Show answered/accepted/declined
    irWhere.status = { in: ['ANSWERED', 'ACCEPTED', 'DECLINED'] }
  } else if (status === 'all') {
    // No status filter - show all
  } else if (type !== 'task') {
    irWhere.status = status.toUpperCase()
  }

  // Get information requests (unless filtering by task type)
  let informationRequests: any[] = []
  if (type !== 'task') {
    informationRequests = await prisma.informationRequest.findMany({
      where: irWhere,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        respondedBy: {
          select: { id: true, name: true }
        },
        externalComments: {
          include: {
            author: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get stakeholder info and parse votes for each IR
    for (const ir of informationRequests) {
      const stakeholderAccess = await prisma.stakeholderAccess.findFirst({
        where: {
          userId: ir.createdById,
          externalSpaceId: ir.externalSpaceId
        },
        select: { displayName: true, position: true }
      })
      ir.submitterInfo = {
        displayName: stakeholderAccess?.displayName || ir.createdBy.name || ir.createdBy.email,
        position: stakeholderAccess?.position
      }
      // Parse votes from JSON
      ir.voteCount = Array.isArray(ir.votes) ? ir.votes.length : 0
    }
  }

  // Format response
  const tasks = externalTasks.map(task => ({
    id: task.id,
    type: 'task' as const,
    spaceId: task.externalSpaceId,
    spaceName: spaceMap.get(task.externalSpaceId)?.name || 'Unknown',
    title: task.title,
    description: task.description,
    status: task.status.toLowerCase(),
    submitter: task.submitterInfo,
    submittedAt: task.createdAt.toISOString(),
    internalNotes: task.internalNotes,
    linkedTaskId: task.linkedTaskId,
    rejectionReason: task.rejectionReason,
    comments: task.externalComments.map((c: any) => ({
      id: c.id,
      authorName: c.author.name || 'Unknown',
      content: c.content,
      isTeamMember: c.isTeamMember,
      createdAt: c.createdAt.toISOString()
    }))
  }))

  const irs = informationRequests.map(ir => ({
    id: ir.id,
    type: ir.type.toLowerCase() as 'question' | 'suggestion',
    spaceId: ir.externalSpaceId,
    spaceName: spaceMap.get(ir.externalSpaceId)?.name || 'Unknown',
    content: ir.content,
    status: ir.status.toLowerCase(),
    submitter: ir.submitterInfo,
    submittedAt: ir.createdAt.toISOString(),
    voteCount: ir.voteCount,
    response: ir.response,
    respondedAt: ir.respondedAt?.toISOString(),
    respondedBy: ir.respondedBy?.name,
    addedToAIContext: ir.addedToAIContext,
    convertedToTaskId: ir.convertedToTaskId,
    comments: ir.externalComments?.map((c: any) => ({
      id: c.id,
      authorName: c.author.name || 'Unknown',
      content: c.content,
      isTeamMember: c.isTeamMember,
      createdAt: c.createdAt.toISOString()
    })) || []
  }))

  // Combine and sort by date
  const items = [...tasks, ...irs].sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )

  return {
    items,
    spaces: spaces.map(s => ({ id: s.id, name: s.name, slug: s.slug })),
    counts: {
      tasks: tasks.length,
      questions: irs.filter(ir => ir.type === 'question').length,
      suggestions: irs.filter(ir => ir.type === 'suggestion').length,
      total: items.length
    }
  }
})
