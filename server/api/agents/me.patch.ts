import { requireTokenUser } from '../../utils/agentApi'
import { prisma } from '../../utils/prisma'

/**
 * Allow an agent to update its own runner config
 */
export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)
  const body = await readBody(event)

  const data: Record<string, any> = {}

  if (typeof body.runnerCommand === 'string' || body.runnerCommand === null) {
    data.runnerCommand = body.runnerCommand
  }
  if (typeof body.runnerArgs === 'string' || body.runnerArgs === null) {
    data.runnerArgs = body.runnerArgs
  }

  if (!Object.keys(data).length) {
    throw createError({ statusCode: 400, message: 'No changes provided' })
  }

  const updated = await prisma.user.update({
    where: { id: agent.id },
    data,
    select: {
      id: true,
      name: true,
      runnerCommand: true,
      runnerArgs: true,
    },
  })

  return updated
})
