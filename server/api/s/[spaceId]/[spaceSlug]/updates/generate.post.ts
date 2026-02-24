import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'
import { checkCanUseAICredit, consumeAICredit } from '../../../../../utils/planLimits'

const AI_CREDIT_COST = 25

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const config = useRuntimeConfig()
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
  }

  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API key not configured' })
  }

  // Find space by ID + slug (both in URL now)
  const space = await prisma.externalSpace.findFirst({
    where: { id: spaceId, slug: spaceSlug, archived: false },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          workspaceId: true,
          progress: true,
          confidence: true,
        },
      },
    },
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Get workspace to find organizationId
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: space.project.workspaceId },
    select: { organizationId: true },
  })
  const organizationId = workspace.organizationId

  // Verify user is an internal team member: active workspace member OR active org member
  const [workspaceMembership, orgMembership] = await Promise.all([
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
          organizationId,
          userId: user.id,
        },
      },
      select: { status: true },
    }),
  ])

  const isActiveWorkspaceMember = workspaceMembership?.status === 'ACTIVE'
  const isActiveOrgMember = orgMembership?.status === 'ACTIVE'

  if (!isActiveWorkspaceMember && !isActiveOrgMember) {
    throw createError({ statusCode: 403, statusMessage: 'Only team members can generate updates' })
  }

  // Check AI credits
  const creditCheck = await checkCanUseAICredit(organizationId, user.id)
  if (!creditCheck.allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'AI usage limit reached for this month. Adjust configured limits to continue.',
    })
  }

  // Gather project data in parallel
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const [activeItems, recentCompletions, blockedItems, aiContextDocs] = await Promise.all([
    prisma.item.findMany({
      where: {
        projectId: space.projectId,
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        confidence: true,
        dueDate: true,
        owner: { select: { name: true } },
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.item.findMany({
      where: {
        projectId: space.projectId,
        status: 'DONE',
        completedAt: { gte: fourteenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        completedAt: true,
      },
      take: 20,
      orderBy: { completedAt: 'desc' },
    }),
    prisma.item.findMany({
      where: {
        projectId: space.projectId,
        status: 'BLOCKED',
      },
      select: {
        id: true,
        title: true,
        blockedBy: {
          select: {
            blockingItem: { select: { title: true, status: true } },
          },
        },
      },
    }),
    prisma.aIContextDoc.findMany({
      where: { projectId: space.projectId },
      select: { title: true, content: true },
    }),
  ])

  // Build context for the AI
  const projectContext = [
    `Project: ${space.project.title}`,
    space.project.description ? `Description: ${space.project.description}` : null,
    `Overall Progress: ${space.project.progress}%`,
    `Overall Confidence: ${space.project.confidence}%`,
    '',
    `Active Items (${activeItems.length}):`,
    ...activeItems.map((item) => {
      const parts = [`- ${item.title} [${item.status}] progress:${item.progress}% confidence:${item.confidence}%`]
      if (item.dueDate) parts.push(`  due:${item.dueDate.toISOString().split('T')[0]}`)
      if (item.owner?.name) parts.push(`  owner:${item.owner.name}`)
      return parts.join('')
    }),
    '',
    `Recently Completed (last 14 days, ${recentCompletions.length} items):`,
    ...recentCompletions.map(
      (item) => `- ${item.title} (completed ${item.completedAt?.toISOString().split('T')[0]})`
    ),
    '',
    blockedItems.length > 0
      ? `Blocked Items (${blockedItems.length}):\n${blockedItems
          .map(
            (item) =>
              `- ${item.title} blocked by: ${item.blockedBy.map((b) => b.blockingItem.title).join(', ')}`
          )
          .join('\n')}`
      : 'No blocked items.',
  ]
    .filter((line) => line !== null)
    .join('\n')

  const contextDocsText =
    aiContextDocs.length > 0
      ? `\n\nAdditional Context Documents:\n${aiContextDocs.map((d) => `### ${d.title}\n${d.content}`).join('\n\n')}`
      : ''

  const systemPrompt = `You write short, clear stakeholder updates for external audiences (clients, investors, partners). These people are NOT on the engineering team — they want to know the project is on track, not how the sausage is made.

Rules:
- Summary: ONE short paragraph (3-5 sentences). Lead with the headline: is the project on track? Then the most important thing that happened and what's coming next. No internal planning language ("resource attention", "critical path", "rebalance").
- Wins: 3-4 bullet points MAX. Each bullet is ONE sentence. No raw percentages or confidence numbers. Focus on what was accomplished and why it matters, not metrics.
- Risks: 2-3 bullet points MAX. Each bullet is ONE sentence. Frame as "what we're keeping an eye on", not internal resourcing concerns. Only surface risks a stakeholder would actually care about (timeline, quality, scope) — skip internal staffing or task-level detail.
- NEVER include percentage progress, confidence scores, or due dates in wins or risks. The data is for YOUR analysis — the output should be plain English.
- Tone: confident, warm, honest. Like a trusted partner giving a quick verbal update over coffee.

${contextDocsText}`

  const toolSchema = {
    type: 'function' as const,
    function: {
      name: 'generate_status_update',
      description: 'Generate a structured stakeholder status update',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short title, e.g. "Status Update - Feb 10"',
          },
          summary: {
            type: 'string',
            description: 'One short paragraph (3-5 sentences). Plain English, no metrics or internal jargon.',
          },
          wins: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'One sentence describing what was accomplished and why it matters. No percentages.' },
              },
              required: ['text'],
            },
            description: '3-4 wins maximum',
            maxItems: 4,
          },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'One sentence about what we are watching. No percentages or internal detail.' },
              },
              required: ['text'],
            },
            description: '2-3 risks maximum',
            maxItems: 3,
          },
        },
        required: ['title', 'summary', 'risks', 'wins'],
      },
    },
  }

  const baseUrl = config.openaiBaseUrl || 'https://api.openai.com/v1'
  const model = config.openaiModel || 'gpt-5-mini'

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: projectContext },
      ],
      tools: [toolSchema],
      tool_choice: {
        type: 'function',
        function: { name: 'generate_status_update' },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenAI API error:', errorText)
    throw createError({ statusCode: 502, statusMessage: 'AI service error' })
  }

  const data = await response.json()
  const message = data?.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find(
    (call: any) => call?.function?.name === 'generate_status_update'
  )

  if (!toolCall?.function?.arguments) {
    throw createError({ statusCode: 502, statusMessage: 'AI did not return structured output' })
  }

  const generated = JSON.parse(toolCall.function.arguments) as {
    title: string
    summary: string
    risks: Array<{ text: string }>
    wins: Array<{ text: string }>
  }

  // Create the SpaceUpdate record
  const spaceUpdate = await prisma.spaceUpdate.create({
    data: {
      externalSpaceId: space.id,
      generatedById: user.id,
      title: generated.title,
      summary: generated.summary,
      risks: generated.risks,
      wins: generated.wins,
      aiModel: model,
      projectSnapshot: {
        progress: space.project.progress,
        confidence: space.project.confidence,
        activeCount: activeItems.length,
        completedCount: recentCompletions.length,
        blockedCount: blockedItems.length,
      },
    },
    include: {
      generatedBy: { select: { name: true } },
    },
  })

  // Consume AI credits
  await consumeAICredit(organizationId, user.id, AI_CREDIT_COST)

  return spaceUpdate
})
