import { requireUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { apiToken: null },
  })

  return { revoked: true }
})
