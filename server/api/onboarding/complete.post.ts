import { prisma } from '../../utils/prisma'
import { seedDemoData } from '../../utils/seedDemoData'

interface OnboardingRequest {
  organization: {
    name: string
    slug: string
  }
  workspace: {
    name: string
    description?: string | null
  }
  user: {
    name: string
    email: string
  }
  loadDemoData: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<OnboardingRequest>(event)

  // Validation
  if (!body.organization?.name || !body.organization?.slug) {
    throw createError({ statusCode: 400, message: 'Organization name and slug are required' })
  }
  if (!body.workspace?.name) {
    throw createError({ statusCode: 400, message: 'Workspace name is required' })
  }
  if (!body.user?.name || !body.user?.email) {
    throw createError({ statusCode: 400, message: 'User name and email are required' })
  }

  // Check if org slug is taken
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: body.organization.slug }
  })
  if (existingOrg) {
    throw createError({ statusCode: 400, message: 'This organization URL is already taken' })
  }

  // Check if email is taken
  const existingUser = await prisma.user.findUnique({
    where: { email: body.user.email }
  })
  if (existingUser) {
    throw createError({ statusCode: 400, message: 'An account with this email already exists' })
  }

  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create organization
    const organization = await tx.organization.create({
      data: {
        name: body.organization.name,
        slug: body.organization.slug,
      }
    })

    // 2. Create user
    const user = await tx.user.create({
      data: {
        name: body.user.name,
        email: body.user.email,
      }
    })

    // 3. Create org membership (as owner)
    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      }
    })

    // 4. Create workspace with a slug based on name
    const workspaceSlug = body.workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)

    const workspace = await tx.workspace.create({
      data: {
        organizationId: organization.id,
        name: body.workspace.name,
        slug: `${body.organization.slug}-${workspaceSlug}`,
        description: body.workspace.description,
      }
    })

    // 5. Create workspace membership (as owner)
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'OWNER',
      }
    })

    return { organization, workspace, user }
  })

  // Seed demo data if requested (outside transaction for performance)
  if (body.loadDemoData) {
    try {
      await seedDemoData(result.workspace.id, result.user.id)
    } catch (err) {
      console.error('Failed to seed demo data:', err)
      // Don't fail the whole request if seeding fails
    }
  }

  // Set a session cookie (simplified - in production use proper JWT)
  setCookie(event, 'relai_user_id', result.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return {
    success: true,
    organization: {
      id: result.organization.id,
      name: result.organization.name,
      slug: result.organization.slug,
    },
    workspace: {
      id: result.workspace.id,
      name: result.workspace.name,
      slug: result.workspace.slug,
    },
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
    },
  }
})
