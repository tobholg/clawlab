import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ name: string; description?: string }>(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  // Generate slug from name
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Check if slug exists
  const existing = await prisma.project.findUnique({ where: { slug } })
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: 'A project with this name already exists' })
  }

  const project = await prisma.project.create({
    data: {
      name: body.name.trim(),
      slug,
      description: body.description?.trim(),
      members: {
        create: {
          userId: user.id,
          role: 'BUILDER'
        }
      }
    }
  })

  return { project }
})
