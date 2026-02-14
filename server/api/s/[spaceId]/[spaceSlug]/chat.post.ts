import { defineEventHandler, getRouterParam, readBody, createError, setResponseHeader } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  content: string
  history?: Message[]
}

// Build system prompt with project context
const buildSystemPrompt = (context: {
  spaceName: string
  projectTitle: string
  projectDescription: string | null
  canSubmitTasks: boolean
  activeTasks: Array<{ title: string; description: string | null; status: string; progress: number }>
  completedTasks: Array<{ title: string; description: string | null; completedAt: Date | null }>
  aiContextDocs: Array<{ title: string; content: string }>
  recentIRs: Array<{ type: string; content: string; response: string | null; status: string }>
}) => {
  const lines = [
    `You are a friendly assistant helping external stakeholders (clients, partners, sales teams) stay informed about "${context.projectTitle}".`,
    '',
    '## IMPORTANT: Communication Style',
    '- ALWAYS reply in the same language the user writes in. If they write Norwegian, reply fully in Norwegian. If French, reply in French. Never mix languages.',
    '- Keep responses SHORT (2-3 sentences when possible)',
    '- Use simple, everyday language — NO technical jargon',
    '- Imagine you\'re explaining to someone who has never written code',
    '- Be warm and helpful, like a knowledgeable colleague',
    '- Instead of saying "I\'ll create an Information Request", say the equivalent of "I\'ll check with the team" in whatever language the user is using',
    '- If something is "in progress", say it\'s "being worked on"',
    '- Never mention internal team member names',
    '',
  ]

  // What you can help with
  lines.push('## What You Can Help With')
  lines.push('- Answer questions about what the team is working on')
  lines.push('- Share what\'s been completed recently')
  lines.push('- If you don\'t know something, offer to ask the team for them')
  if (context.canSubmitTasks) {
    lines.push('- Help them report bugs or request features')
  } else {
    lines.push('- Help them submit suggestions or feedback')
  }
  lines.push('')

  // Project info
  if (context.projectDescription) {
    lines.push('## About This Project')
    lines.push(context.projectDescription)
    lines.push('')
  }

  // AI context docs (owner-curated knowledge)
  if (context.aiContextDocs.length > 0) {
    lines.push('## Things You Know')
    for (const doc of context.aiContextDocs) {
      lines.push(`### ${doc.title}`)
      lines.push(doc.content)
      lines.push('')
    }
  }

  // Active tasks (anonymized) - simplified language
  if (context.activeTasks.length > 0) {
    lines.push('## What\'s Being Worked On Right Now')
    for (const task of context.activeTasks) {
      const progress = task.progress > 0 ? ` (about ${task.progress}% done)` : ''
      lines.push(`- ${task.title}${progress}`)
      if (task.description) {
        lines.push(`  Details: ${task.description}`)
      }
    }
    lines.push('')
  }

  // Recently completed (shows progress)
  if (context.completedTasks.length > 0) {
    lines.push('## Recently Finished')
    for (const task of context.completedTasks.slice(0, 5)) {
      lines.push(`- ${task.title}`)
      if (task.description) {
        lines.push(`  Details: ${task.description}`)
      }
    }
    lines.push('')
  }

  // Previous IRs + responses (avoid re-asking)
  if (context.recentIRs.length > 0) {
    lines.push('## Questions Already Asked (don\'t repeat these)')
    for (const ir of context.recentIRs.slice(0, 10)) {
      lines.push(`- Q: ${ir.content}`)
      if (ir.response) {
        lines.push(`  A: ${ir.response}`)
      } else {
        lines.push(`  (Waiting for team response)`)
      }
    }
    lines.push('')
  }

  // Action format instructions (internal - user doesn't see this)
  lines.push('## When To Ask The Team')
  lines.push('If someone asks something you can\'t answer from the info above, offer to check with the team.')
  lines.push('Say something like: "I\'m not sure about that — want me to check with the team for you?"')
  lines.push('')
  lines.push('When they say yes, output this EXACT format (the system will show them a nice preview):')
  lines.push('')
  lines.push('[ACTION:CREATE_IR]')
  lines.push('type: question')
  lines.push('content: Write their question clearly here')
  lines.push('[/ACTION]')
  lines.push('')
  lines.push('For suggestions or feature ideas, use type: suggestion')
  lines.push('')
  if (context.canSubmitTasks) {
    lines.push('## Reporting Bugs or Issues')
    lines.push('If they want to report a bug or problem, use:')
    lines.push('')
    lines.push('[ACTION:CREATE_TASK]')
    lines.push('title: Short description of the issue')
    lines.push('description: Full details about what happened')
    lines.push('[/ACTION]')
    lines.push('')
  }
  lines.push('RULES:')
  lines.push('- Only create an ACTION when they\'ve clearly agreed to submit something')
  lines.push('- Keep your conversational responses to 2-3 sentences max')
  lines.push('- Be friendly and reassuring, never robotic')

  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'AI service not configured',
    })
  }

  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.content?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Content is required',
    })
  }

  // Find space and verify user has access
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      slug: spaceSlug,
      archived: false
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
        }
      }
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Portal not found' })
  }

  // Check if user is a team member (workspace member OR org member)
  let isTeamMember = false
  const workspace = await prisma.workspace.findFirst({
    where: { items: { some: { id: space.projectId } } },
    select: { id: true, organizationId: true },
  })
  if (workspace) {
    const [wsMembership, orgMembership] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
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
    isTeamMember = wsMembership?.status === 'ACTIVE' || orgMembership?.status === 'ACTIVE'
  }

  // Check if user has stakeholder access
  const access = await prisma.stakeholderAccess.findUnique({
    where: {
      userId_externalSpaceId: {
        userId: user.id,
        externalSpaceId: space.id
      }
    }
  })

  if (!access && !isTeamMember) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this portal' })
  }

  // Determine permissions — team members get full access
  const canSubmitTasks = isTeamMember ? space.allowTaskSubmission : (access?.canSubmitTasks ?? space.allowTaskSubmission)

  // Load project context
  const [activeTasks, completedTasks, aiContextDocs, recentIRs] = await Promise.all([
    // Active tasks (anonymized)
    prisma.item.findMany({
      where: {
        OR: [
          { id: space.projectId },
          { projectId: space.projectId }
        ],
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
        parentId: { not: null }
      },
      select: {
        title: true,
        description: true,
        status: true,
        progress: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    }),
    // Recently completed tasks
    prisma.item.findMany({
      where: {
        OR: [
          { id: space.projectId },
          { projectId: space.projectId }
        ],
        status: 'DONE',
        completedAt: { not: null },
        parentId: { not: null }
      },
      select: {
        title: true,
        description: true,
        completedAt: true
      },
      orderBy: { completedAt: 'desc' },
      take: 10
    }),
    // AI context docs
    prisma.aIContextDoc.findMany({
      where: { projectId: space.projectId },
      select: {
        title: true,
        content: true
      },
      orderBy: { addedAt: 'desc' }
    }),
    // Recent IRs with responses
    prisma.informationRequest.findMany({
      where: { externalSpaceId: space.id },
      select: {
        type: true,
        content: true,
        response: true,
        status: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ])

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    spaceName: space.name,
    projectTitle: space.project.title,
    projectDescription: space.project.description,
    canSubmitTasks,
    activeTasks,
    completedTasks,
    aiContextDocs,
    recentIRs
  })

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Add history if provided
  if (body.history?.length) {
    for (const msg of body.history) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add current message
  messages.push({ role: 'user', content: body.content })

  // Determine API endpoint
  const baseUrl = config.openaiBaseUrl || 'https://api.openai.com/v1'
  const model = config.openaiModel || 'gpt-4o-mini'

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_completion_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw createError({
        statusCode: response.status,
        message: `AI service error: ${response.statusText}`,
      })
    }

    // Set up streaming response
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setResponseHeader(event, 'Cache-Control', 'no-cache')
    setResponseHeader(event, 'Connection', 'keep-alive')

    const reader = response.body?.getReader()
    if (!reader) {
      throw createError({
        statusCode: 500,
        message: 'No response body from AI service',
      })
    }

    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    
    // Create a readable stream that processes the OpenAI SSE format
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error)
        } finally {
          controller.close()
        }
      },
    })

    return stream
  } catch (error: any) {
    if (error.statusCode) throw error
    
    console.error('Stakeholder chat error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to process chat request',
    })
  }
})
