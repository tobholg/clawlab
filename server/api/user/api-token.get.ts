import { requireUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

function maskToken(token: string) {
  return `ctx_...${token.slice(-4)}`
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { apiToken: true },
  })

  if (!user?.apiToken) {
    return { exists: false }
  }

  return {
    exists: true,
    masked: maskToken(user.apiToken),
  }
})
