import { defineEventHandler, readBody, createError, setResponseHeader } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { checkCanUseAICredit, consumeAICredit } from '../../utils/planLimits'

const AI_CREDIT_COST = 7
const MAX_INPUT_LENGTH = 8192
const MAX_HISTORY_MESSAGES = 20

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  content: string
  history?: Message[]
  workspaceId?: string
}

const SYSTEM_PROMPT = `You are a helpful assistant for Relai, a project management tool.

Key points:
- Be concise and helpful
- You can help users understand their projects, tasks, and timelines
- Provide actionable advice when asked about project management
- Keep responses focused and to the point
- Use markdown formatting when helpful (lists, bold, code blocks)

If asked about specific project data you don't have access to, let the user know you can only provide general guidance.`

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const config = useRuntimeConfig()

  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenAI API key not configured',
    })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.content?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Content is required',
    })
  }

  if (body.content.length > MAX_INPUT_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `Message must be ${MAX_INPUT_LENGTH} characters or fewer`,
    })
  }

  // Check AI credits
  if (body.workspaceId) {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: body.workspaceId },
      select: { organizationId: true },
    })
    const creditCheck = await checkCanUseAICredit(workspace.organizationId, user.id)
    if (!creditCheck.allowed) {
      throw createError({ statusCode: 403, message: 'AI credit limit reached for this month. Upgrade to Pro for 10,000 credits/user/month.' })
    }
  }

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  // Add history if provided (limited to MAX_HISTORY_MESSAGES)
  if (body.history?.length) {
    const trimmedHistory = body.history.slice(-MAX_HISTORY_MESSAGES)
    for (const msg of trimmedHistory) {
      messages.push({ role: msg.role, content: msg.content.slice(0, MAX_INPUT_LENGTH) })
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
        max_completion_tokens: 1024,
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

    // Consume AI credits after successful API call
    if (body.workspaceId) {
      const workspace = await prisma.workspace.findUniqueOrThrow({
        where: { id: body.workspaceId },
        select: { organizationId: true },
      })
      await consumeAICredit(workspace.organizationId, user.id, AI_CREDIT_COST)
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

    console.error('Quick chat error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to process chat request',
    })
  }
})
