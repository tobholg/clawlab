import { prisma } from '../../utils/prisma'
import { seedDemoData } from '../../utils/seedDemoData'
import { createDefaultChannels } from '../../utils/channelUtils'
import { createSession } from '../../utils/auth'
import { provisionDefaultSeats } from '../../utils/seats'

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
  teamEmails?: string[]
  loadDemoData: boolean
  planTier?: 'PRO'
  seatSelection?: { internal: number; external: number }
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

  // Plan tier validation
  const tier = body.planTier === 'PRO' ? 'PRO' : 'FREE' as const

  if (tier === 'PRO') {
    if (!body.seatSelection || body.seatSelection.internal < 1 || body.seatSelection.internal > 100) {
      throw createError({ statusCode: 400, message: 'Pro requires 1-100 internal seats' })
    }
    if (body.seatSelection.external < 0 || body.seatSelection.external > 100) {
      throw createError({ statusCode: 400, message: 'External seats must be 0-100' })
    }
    if (body.teamEmails && body.teamEmails.length > body.seatSelection.internal - 1) {
      throw createError({ statusCode: 400, message: 'Too many invites for selected seat count' })
    }
  } else {
    if (body.teamEmails && body.teamEmails.length > 4) {
      throw createError({ statusCode: 400, message: 'Free plan allows up to 4 team invites' })
    }
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
        planTier: tier,
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

  // Provision seats for the organization and occupy one for the owner
  try {
    if (tier === 'PRO' && body.seatSelection) {
      // Pro: create exact seat counts chosen by user
      const seats: { organizationId: string; type: 'INTERNAL' | 'EXTERNAL'; status: 'AVAILABLE' }[] = []
      for (let i = 0; i < body.seatSelection.internal; i++) {
        seats.push({ organizationId: result.organization.id, type: 'INTERNAL', status: 'AVAILABLE' })
      }
      for (let i = 0; i < body.seatSelection.external; i++) {
        seats.push({ organizationId: result.organization.id, type: 'EXTERNAL', status: 'AVAILABLE' })
      }
      if (seats.length > 0) {
        await prisma.seat.createMany({ data: seats })
      }
    } else {
      // Free: provision default seats (5 internal + 3 external)
      await provisionDefaultSeats(result.organization.id, 'FREE')
    }

    // Occupy one internal seat for the owner
    const ownerSeat = await prisma.seat.findFirst({
      where: { organizationId: result.organization.id, type: 'INTERNAL', status: 'AVAILABLE' },
    })
    if (ownerSeat) {
      await prisma.seat.update({
        where: { id: ownerSeat.id },
        data: { status: 'OCCUPIED', userId: result.user.id, occupiedAt: new Date() },
      })
    }
  } catch (err) {
    console.error('Failed to provision seats:', err)
  }

  // Create default channels (#general, #off-topic) for the new workspace
  let channels: any[] = []
  try {
    channels = await createDefaultChannels(result.workspace.id, result.user.id)
  } catch (err) {
    console.error('Failed to create default channels:', err)
    // Don't fail the whole request if channel creation fails
  }

  // Create invited team members
  const createdTeamMembers: any[] = []
  if (body.teamEmails && body.teamEmails.length > 0) {
    for (const email of body.teamEmails) {
      try {
        // Check if user already exists
        let teamUser = await prisma.user.findUnique({
          where: { email }
        })

        if (!teamUser) {
          // Create new user with name derived from email
          const nameFromEmail = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          teamUser = await prisma.user.create({
            data: {
              email,
              name: nameFromEmail,
            }
          })
        }

        // Add to organization
        await prisma.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: result.organization.id,
              userId: teamUser.id,
            }
          },
          update: {},
          create: {
            organizationId: result.organization.id,
            userId: teamUser.id,
            role: 'MEMBER',
          }
        })

        // Add to workspace
        await prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: result.workspace.id,
              userId: teamUser.id,
            }
          },
          update: {},
          create: {
            workspaceId: result.workspace.id,
            userId: teamUser.id,
            role: 'MEMBER',
          }
        })

        // Add to default channels
        for (const channel of channels) {
          await prisma.channelMember.upsert({
            where: {
              channelId_userId: {
                channelId: channel.id,
                userId: teamUser.id,
              }
            },
            update: {},
            create: {
              channelId: channel.id,
              userId: teamUser.id,
              role: 'MEMBER',
            }
          })
        }

        // Occupy a seat for this team member
        const teamSeat = await prisma.seat.findFirst({
          where: { organizationId: result.organization.id, type: 'INTERNAL', status: 'AVAILABLE' },
        })
        if (teamSeat) {
          await prisma.seat.update({
            where: { id: teamSeat.id },
            data: { status: 'OCCUPIED', userId: teamUser.id, occupiedAt: new Date() },
          })
        }

        createdTeamMembers.push({
          id: teamUser.id,
          email: teamUser.email,
          name: teamUser.name,
        })
      } catch (err) {
        console.error(`Failed to create team member ${email}:`, err)
        // Continue with other team members
      }
    }
  }

  // Seed demo data if requested (outside transaction for performance)
  if (body.loadDemoData) {
    try {
      await seedDemoData(result.workspace.id, result.user.id)
    } catch (err) {
      console.error('Failed to seed demo data:', err)
      // Don't fail the whole request if seeding fails
    }
  }

  // Create proper auth session
  await createSession(event, { id: result.user.id, email: result.user.email })

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
    teamMembers: createdTeamMembers,
  }
})
