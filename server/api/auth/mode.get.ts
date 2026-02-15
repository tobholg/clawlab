import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const magicLink = !!config.postmarkApiToken

  const userCount = await prisma.user.count({ where: { isAgent: false } })

  return {
    magicLink,
    password: true,
    singleUser: userCount === 1,
  }
})
