import { defineEventHandler } from 'h3'
import { getSessionUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  return {
    authenticated: !!user,
    user: user || null
  }
})
