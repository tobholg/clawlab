import { randomUUID } from 'node:crypto'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { broadcastNewMessage } from '../../../utils/websocket'

const MAX_CONTEXT_MESSAGES = 64
const AI_EMAIL = 'ai@relai.local'
const AI_NAME = 'Relai AI'

type ProjectSummary = {
  id: string
  title: string
  description: string | null
}

type ProposedTask = {
  title: string
  description?: string | null
  children?: ProposedTask[]
}

type TaskProposal = {
  id: string
  parentTitle: string
  projectId: string | null
  projectTitle?: string | null
  tasks: ProposedTask[]
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const channelId = getRouterParam(event, 'id')
  const body = await readBody<{ prompt?: string }>(event)

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const prompt = body?.prompt?.trim()
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'prompt is required' })
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, displayName: true, workspaceId: true, projectId: true },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  const recentMessages = await prisma.message.findMany({
    where: { channelId, deleted: false },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_CONTEXT_MESSAGES,
  })

  const projects = await prisma.item.findMany({
    where: { workspaceId: channel.workspaceId, parentId: null },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: 'asc' },
  })

  const systemPrompt = buildSystemPrompt(channel.displayName, channel.projectId, projects, recentMessages.reverse())
  let content = ''
  let proposal: TaskProposal | null = null
  try {
    const result = await callOpenAi(prompt, systemPrompt, projects)
    content = result.content
    proposal = result.proposal
  } catch (error: any) {
    console.error('[AI] OpenAI request failed:', error?.message || error)
    content = 'I ran into an issue reaching the AI service. Please try again in a moment.'
  }

  const aiUser = await prisma.user.upsert({
    where: { email: AI_EMAIL },
    update: { name: AI_NAME },
    create: { email: AI_EMAIL, name: AI_NAME },
  })

  const message = await prisma.message.create({
    data: {
      channelId,
      userId: aiUser.id,
      content: content || 'I prepared a task proposal below.',
      attachments: proposal ? [{ type: 'task_proposal', proposal }] : undefined,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      _count: { select: { replies: true } },
    },
  })

  const formattedMessage = {
    id: message.id,
    channelId: message.channelId,
    userId: message.userId,
    parentId: message.parentId,
    content: message.content,
    attachments: message.attachments,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    user: message.user,
    replyCount: message._count.replies,
  }

  broadcastNewMessage(channelId, formattedMessage, aiUser.id)

  return formattedMessage
})

function buildSystemPrompt(
  channelName: string,
  channelProjectId: string | null,
  projects: ProjectSummary[],
  messages: { id: string; content: string; parentId: string | null; createdAt: Date; user: { name: string | null; email: string } }[]
) {
  const projectLines = projects.length
    ? projects.map(project => `- ${project.id}: ${project.title}${project.description ? ` - ${project.description}` : ''}`).join('\n')
    : '- None'

  const messageById = new Map(messages.map(msg => [msg.id, msg.content]))
  const messageLines = messages.length
    ? messages.map(msg => {
        const author = msg.user.name ? `${msg.user.name} (${msg.user.email})` : msg.user.email
        const replyTo = msg.parentId && messageById.get(msg.parentId)
          ? ` [reply to: "${truncate(messageById.get(msg.parentId) || '')}"]`
          : ''
        return `${author}${replyTo}: ${msg.content}`
      }).join('\n')
    : 'No messages yet.'

  const channelContext = channelProjectId
    ? `Channel is linked to project ID: ${channelProjectId}.`
    : 'Channel is not linked to a project.'

  return [
    'You are Relai AI, a concise, helpful teammate in a project management chat.',
    'When the user requests tasks or bugs to be turned into tasks, call create_task_proposal.',
    'Only call the tool if you are confident which project the tasks belong to.',
    'If the project is unclear, ask a short clarifying question instead of using the tool.',
    'Use project IDs exactly as listed; do not invent IDs.',
    `Channel: #${channelName}`,
    channelContext,
    '',
    'Projects:',
    projectLines,
    '',
    `Recent messages (oldest to newest, max ${MAX_CONTEXT_MESSAGES}):`,
    messageLines,
  ].join('\n')
}

async function callOpenAi(prompt: string, systemPrompt: string, projects: ProjectSummary[]) {
  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey as string | undefined
  const model = (config.openaiModel as string | undefined) || 'gpt-5-mini'
  const baseUrl = (config.openaiBaseUrl as string | undefined)?.replace(/\/$/, '') || 'https://api.openai.com/v1'

  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'OPENAI_API_KEY is not configured' })
  }

  const toolSchema = {
    type: 'function',
    function: {
      name: 'create_task_proposal',
      description: 'Create a parent task with child tasks based on the discussion.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['parentTitle', 'projectId', 'tasks'],
        properties: {
          parentTitle: { type: 'string' },
          projectId: { type: 'string' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title'],
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      children: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['title'],
                          properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    tools: [toolSchema],
    tool_choice: 'auto',
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw createError({ statusCode: 502, message: `OpenAI request failed: ${errorText}` })
  }

  const data = await response.json()
  const message = data?.choices?.[0]?.message
  const content: string = message?.content?.trim() || ''

  const toolCall = message?.tool_calls?.find((call: any) => call?.function?.name === 'create_task_proposal')
  if (!toolCall?.function?.arguments) {
    return { content, proposal: null }
  }

  let parsedArgs: any = null
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments)
  } catch {
    return { content: content || 'I could not parse the task proposal. Please try again.', proposal: null }
  }

  const proposal = buildProposal(parsedArgs, projects)
  if (!proposal) {
    return {
      content: content || 'Which project should these tasks belong to?',
      proposal: null,
    }
  }

  return { content: content || 'Here is a task proposal based on the discussion.', proposal }
}

function buildProposal(args: any, projects: ProjectSummary[]): TaskProposal | null {
  if (!args || typeof args !== 'object') return null
  const parentTitle = typeof args.parentTitle === 'string' ? args.parentTitle.trim() : ''
  const projectId = typeof args.projectId === 'string' ? args.projectId : null
  const tasks = Array.isArray(args.tasks) ? args.tasks : []

  if (!parentTitle || !projectId || tasks.length === 0) return null

  const projectMap = new Map(projects.map(project => [project.id, project]))
  const project = projectMap.get(projectId)
  if (!project) return null

  return {
    id: randomUUID(),
    parentTitle,
    projectId,
    projectTitle: project.title,
    tasks: normalizeTasks(tasks),
  }
}

function normalizeTasks(rawTasks: any[]): ProposedTask[] {
  return rawTasks
    .map(task => ({
      title: typeof task.title === 'string' ? task.title.trim() : '',
      description: typeof task.description === 'string' ? task.description.trim() : undefined,
      children: Array.isArray(task.children) ? normalizeTasks(task.children) : undefined,
    }))
    .filter(task => task.title.length > 0)
}

function truncate(text: string, max = 80) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}
