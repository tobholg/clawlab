import { requireOrgAdmin } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  const auth = await requireOrgAdmin(event, organizationId)
  const body = await readBody(event)
  const { name, billingEmail } = body

  const data: Record<string, any> = {}

  if (name !== undefined) {
    if (auth.orgRole !== 'OWNER') {
      throw createError({ statusCode: 403, message: 'Only the organization owner can change the name' })
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
      throw createError({ statusCode: 400, message: 'Name must be between 1 and 255 characters' })
    }
    data.name = name.trim()
  }

  if (billingEmail !== undefined) {
    if (billingEmail !== null && billingEmail !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (typeof billingEmail !== 'string' || !emailRegex.test(billingEmail)) {
        throw createError({ statusCode: 400, message: 'Invalid email address' })
      }
      data.billingEmail = billingEmail.trim()
    } else {
      data.billingEmail = null
    }
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      billingEmail: true,
      planTier: true,
    },
  })

  return updated
})
