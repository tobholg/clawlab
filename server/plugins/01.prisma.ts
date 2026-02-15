import { initPrisma } from '../utils/prisma'

export default defineNitroPlugin(async () => {
  await initPrisma()
})
