import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const user = await prisma.user.findFirst({ select: { id: true } })
  return { needsSetup: user === null }
})
