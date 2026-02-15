import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const magicLink = !!config.postmarkApiToken

  let userCount = 0
  try {
    userCount = await prisma.user.count({ where: { isAgent: false } })
  } catch {
    // Prisma may not be initialized yet during SSR prerender
    return { magicLink, password: true, singleUser: false }
  }

  return {
    magicLink,
    password: true,
    singleUser: userCount === 1,
  }
})
