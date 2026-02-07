import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { getDefaultSubStatus } from '../../utils/itemStage'

type ItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type ItemComplexity = 'TRIVIAL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'EPIC'

type ProposedSubtask = {
  title: string
  description?: string
  category?: string
  priority?: ItemPriority
  complexity?: ItemComplexity
  dueDate?: string
}

type ProposedTask = {
  title: string
  description?: string
  category?: string
  priority?: ItemPriority
  complexity?: ItemComplexity
  dueDate?: string
  subtasks?: ProposedSubtask[]
}

const MAX_SUBTASKS = 5
const ALLOWED_CATEGORIES = [
  'Engineering',
  'Bug',
  'Design',
  'Product',
  'QA',
  'Research',
  'Operations',
  'Marketing',
]
const ALLOWED_PRIORITIES: ItemPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const ALLOWED_COMPLEXITIES: ItemComplexity[] = ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE', 'EPIC']

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const config = useRuntimeConfig()

  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, message: 'AI service is not configured' })
  }

  const body = await readBody<{ workspaceId?: string; parentId?: string | null; input?: string }>(event)
  const workspaceId = body.workspaceId?.trim()
  const parentId = body.parentId?.trim() || null
  const input = body.input?.trim()

  if (!workspaceId || !parentId || !input) {
    throw createError({ statusCode: 400, message: 'workspaceId, parentId, and input are required' })
  }

  const parent = await prisma.item.findFirst({
    where: {
      id: parentId,
      workspaceId,
    },
    select: {
      id: true,
      title: true,
      projectId: true,
    },
  })

  if (!parent) {
    throw createError({ statusCode: 404, message: 'Parent item not found in this workspace' })
  }

  const projectId = parent.projectId ?? parent.id

  const proposed = await generateTaskFromInput({
    input,
    parentTitle: parent.title,
    model: (config.openaiModel as string | undefined) || 'gpt-5-mini',
    baseUrl: ((config.openaiBaseUrl as string | undefined) || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: config.openaiApiKey as string,
  })

  const rootTask = normalizeTask(proposed)
  const rootCategory = resolveCategory({
    proposedCategory: rootTask.category,
    requestInput: input,
    title: rootTask.title,
    description: rootTask.description,
  })

  if (!rootTask.title) {
    throw createError({ statusCode: 422, message: 'Could not generate a task title from input' })
  }

  const createdRoot = await createItem({
    workspaceId,
    parentId,
    projectId,
    ownerId: user.id,
    title: rootTask.title,
    description: rootTask.description ?? null,
    category: rootCategory,
    priority: rootTask.priority,
    complexity: rootTask.complexity,
    dueDate: parseDueDate(rootTask.dueDate),
  })

  let subtaskCount = 0
  for (const subtask of rootTask.subtasks.slice(0, MAX_SUBTASKS)) {
    if (!subtask.title) continue
    await createItem({
      workspaceId,
      parentId: createdRoot.id,
      projectId,
      ownerId: user.id,
      title: subtask.title,
      description: subtask.description ?? null,
      category: resolveCategory({
        proposedCategory: subtask.category,
        requestInput: input,
        title: subtask.title,
        description: subtask.description,
        parentCategory: rootCategory,
      }),
      priority: subtask.priority,
      complexity: subtask.complexity,
      dueDate: parseDueDate(subtask.dueDate),
    })
    subtaskCount += 1
  }

  return {
    item: {
      id: createdRoot.id,
      title: createdRoot.title,
      description: createdRoot.description,
      parentId: createdRoot.parentId,
      status: createdRoot.status.toLowerCase(),
      subStatus: createdRoot.subStatus ?? null,
      progress: createdRoot.progress,
      confidence: createdRoot.confidence,
      category: createdRoot.category,
      priority: createdRoot.priority,
      complexity: createdRoot.complexity,
      dueDate: createdRoot.dueDate?.toISOString() ?? null,
      startDate: createdRoot.startDate?.toISOString() ?? null,
      owner: createdRoot.owner
        ? {
            id: createdRoot.owner.id,
            name: createdRoot.owner.name,
            avatar: createdRoot.owner.avatar,
          }
        : null,
      assignee: createdRoot.owner
        ? {
            id: createdRoot.owner.id,
            name: createdRoot.owner.name,
            avatar: createdRoot.owner.avatar,
          }
        : null,
      assignees: [],
      stakeholders: [],
      dependencyIds: [],
      children: [],
      depth: 0,
      temperature: 'cold',
      createdAt: createdRoot.createdAt.toISOString(),
      updatedAt: createdRoot.updatedAt.toISOString(),
      lastActivityAt: createdRoot.lastActivityAt.toISOString(),
      childrenCount: subtaskCount,
      hotChildrenCount: 0,
      blockedChildrenCount: 0,
      atRiskChildrenCount: 0,
      needsEstimateChildrenCount: 0,
    },
    subtaskCount,
    createdTaskCount: subtaskCount + 1,
  }
})

async function generateTaskFromInput(params: {
  input: string
  parentTitle: string
  model: string
  baseUrl: string
  apiKey: string
}) {
  const toolSchema = {
    type: 'function',
    function: {
      name: 'create_item',
      description: 'Create either a single task or a parent task with up to 5 subtasks.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'complexity'],
        properties: {
          title: { type: 'string', description: 'Clear task title. If subtasks are present, this is the parent task title.' },
          description: { type: 'string' },
          category: { type: 'string', enum: ALLOWED_CATEGORIES },
          priority: { type: 'string', enum: ALLOWED_PRIORITIES },
          complexity: { type: 'string', enum: ALLOWED_COMPLEXITIES },
          dueDate: { type: 'string', description: 'Optional due date in YYYY-MM-DD format.' },
          subtasks: {
            type: 'array',
            maxItems: MAX_SUBTASKS,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'complexity'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string', enum: ALLOWED_CATEGORIES },
                priority: { type: 'string', enum: ALLOWED_PRIORITIES },
                complexity: { type: 'string', enum: ALLOWED_COMPLEXITIES },
                dueDate: { type: 'string', description: 'Optional due date in YYYY-MM-DD format.' },
              },
            },
          },
        },
      },
    },
  }

  const systemPrompt = [
    'You convert messy input into actionable project tasks.',
    'Given the user input, decide whether to create one task or a parent task with subtasks.',
    `If the input clearly implies a hierarchy, include subtasks (max ${MAX_SUBTASKS}).`,
    'If not, return only a single task (no subtasks).',
    'Do not create 5 subtasks by default.',
    'For short requests (example: "fix bug ASAP"), create one task unless the user explicitly asks for a breakdown.',
    'Never auto-insert generic workflow phases like triage/root cause/implement/test/deploy unless requested.',
    'Category guidance: use "Bug" for bugs, breakages, regressions, crashes, defects, failing behavior, or hotfixes.',
    'Do not label clear bug reports as Engineering.',
    'Titles should be concise and specific.',
    'Descriptions should preserve important detail from the user input.',
    'Every task and subtask must include a complexity estimate: TRIVIAL, SMALL, MEDIUM, LARGE, or EPIC.',
    'Use only provided category and priority enums when confident; omit otherwise.',
    'Never fabricate dates. Only include dueDate when explicitly implied.',
    `This task will be created under parent project: "${params.parentTitle}".`,
  ].join('\n')

  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.input },
      ],
      tools: [toolSchema],
      tool_choice: {
        type: 'function',
        function: { name: 'create_item' },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw createError({ statusCode: 502, message: `AI request failed: ${errorText}` })
  }

  const data = await response.json()
  const message = data?.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find((call: any) => call?.function?.name === 'create_item')

  if (!toolCall?.function?.arguments) {
    throw createError({ statusCode: 502, message: 'AI did not return structured task output' })
  }

  try {
    return JSON.parse(toolCall.function.arguments) as ProposedTask
  } catch {
    throw createError({ statusCode: 502, message: 'AI returned invalid task output' })
  }
}

function normalizeTask(input: any): Required<Omit<ProposedTask, 'description' | 'category' | 'priority' | 'complexity' | 'dueDate'>> & Pick<ProposedTask, 'description' | 'category' | 'priority' | 'complexity' | 'dueDate'> {
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  const description = typeof input?.description === 'string' ? input.description.trim() : undefined
  const category = normalizeCategory(input?.category)
  const priority = normalizePriority(input?.priority)
  const complexity = normalizeComplexity(input?.complexity)
  const dueDate = normalizeDueDate(input?.dueDate)

  const subtasks: ProposedSubtask[] = Array.isArray(input?.subtasks)
    ? input.subtasks
        .slice(0, MAX_SUBTASKS)
        .map((sub: any) => ({
          title: typeof sub?.title === 'string' ? sub.title.trim() : '',
          description: typeof sub?.description === 'string' ? sub.description.trim() : undefined,
          category: normalizeCategory(sub?.category),
          priority: normalizePriority(sub?.priority),
          complexity: normalizeComplexity(sub?.complexity),
          dueDate: normalizeDueDate(sub?.dueDate),
        }))
        .filter((sub: ProposedSubtask) => sub.title.length > 0)
    : []

  return {
    title,
    description,
    category,
    priority,
    complexity,
    dueDate,
    subtasks,
  }
}

function normalizeCategory(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return ALLOWED_CATEGORIES.includes(trimmed) ? trimmed : undefined
}

function hasStrongBugSignal(text: string): boolean {
  if (!text.trim()) return false
  return /\b(bug|regression|crash|crashed|crashing|defect|hotfix|broken|breakage|exception|stack trace|failing|fails|failure)\b/i.test(text)
}

function resolveCategory(params: {
  proposedCategory?: string
  requestInput: string
  title: string
  description?: string
  parentCategory?: string
}): string | undefined {
  const proposed = params.proposedCategory
  const combined = [params.requestInput, params.title, params.description || ''].join(' ').trim()
  const strongBugSignal = hasStrongBugSignal(combined)

  if (strongBugSignal) return 'Bug'

  if (!proposed) {
    if (params.parentCategory === 'Bug') return 'Bug'
    return undefined
  }

  return proposed
}

function normalizePriority(value: unknown): ItemPriority | undefined {
  if (typeof value !== 'string') return undefined
  const upper = value.trim().toUpperCase() as ItemPriority
  return ALLOWED_PRIORITIES.includes(upper) ? upper : undefined
}

function normalizeComplexity(value: unknown): ItemComplexity {
  if (typeof value !== 'string') return 'MEDIUM'
  const upper = value.trim().toUpperCase() as ItemComplexity
  return ALLOWED_COMPLEXITIES.includes(upper) ? upper : 'MEDIUM'
}

function normalizeDueDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined
}

function parseDueDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

async function createItem(params: {
  workspaceId: string
  parentId: string | null
  projectId: string | null
  ownerId: string
  title: string
  description: string | null
  category?: string
  priority?: ItemPriority
  complexity: ItemComplexity
  dueDate: Date | null
}) {
  return prisma.item.create({
    data: {
      workspaceId: params.workspaceId,
      parentId: params.parentId,
      projectId: params.projectId,
      ownerId: params.ownerId,
      title: params.title,
      description: params.description,
      category: params.category,
      priority: params.priority,
      complexity: params.complexity,
      status: 'TODO',
      subStatus: getDefaultSubStatus('TODO'),
      dueDate: params.dueDate,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  })
}
