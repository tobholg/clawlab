import { randomBytes } from 'node:crypto'
import { requireUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const token = `ctx_${randomBytes(20).toString('hex')}`

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { apiToken: token },
  })

  return { token }
})
