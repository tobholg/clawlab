import { randomBytes } from 'node:crypto'
import { prisma } from '../../utils/prisma'
import { seedDemoData } from '../../utils/seedDemoData'
import { createDefaultChannels } from '../../utils/channelUtils'
import { createSession } from '../../utils/auth'
import { provisionDefaultSeats } from '../../utils/seats'
import { hashPassword } from '../../utils/password'
import { defaultRunnerCommandForProvider } from '../../utils/agentRunner'
// Agent tokens stored as plain text (self-hosted, no hashing needed)

interface SetupRequest {
  mode: 'personal' | 'team'
  user: { name: string; email?: string; password: string }
  workspace: { name: string }
  loadDemoData: boolean
  organization?: { name: string; slug: string }
  teamEmails?: string[]
  agents?: Array<{ name: string; provider?: string }>
}

const VALID_AGENT_PROVIDERS = new Set(['openclaw', 'cursor', 'codex', 'custom'])

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

export default defineEventHandler(async (event) => {
  // Guard: reject if any users already exist
  const existingUser = await prisma.user.findFirst({ select: { id: true } })
  if (existingUser) {
    throw createError({ statusCode: 400, message: 'Setup has already been completed' })
  }

  const body = await readBody<SetupRequest>(event)

  // Validate common fields
  if (!body.user?.name) {
    throw createError({ statusCode: 400, message: 'User name is required' })
  }
  if (!body.user?.password || body.user.password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }
  if (!body.workspace?.name) {
    throw createError({ statusCode: 400, message: 'Workspace name is required' })
  }
  if (!['personal', 'team'].includes(body.mode)) {
    throw createError({ statusCode: 400, message: 'Mode must be "personal" or "team"' })
  }

  // Team mode requires email (for identity across multiple users)
  if (body.mode === 'team' && !body.user.email) {
    throw createError({ statusCode: 400, message: 'Email is required for team setup' })
  }

  // Resolve email: use provided email, or generate a local placeholder for personal mode
  const userEmail = body.user.email?.trim().toLowerCase() || 'admin@localhost'

  // Hash password
  const passwordHash = await hashPassword(body.user.password)

  // Determine org name/slug
  let orgName: string
  let orgSlug: string

  if (body.mode === 'team') {
    if (!body.organization?.name || !body.organization?.slug) {
      throw createError({ statusCode: 400, message: 'Organization name and slug are required for team mode' })
    }
    orgName = body.organization.name
    orgSlug = body.organization.slug
  } else {
    // Personal: derive from user name
    const safeName = body.user.name.trim()
    orgName = `${safeName}'s Space`
    orgSlug = safeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    if (orgSlug.length < 2) orgSlug = 'my-space'
  }

  // Team mode: validate invites
  if (body.mode === 'team' && body.teamEmails && body.teamEmails.length > 4) {
    throw createError({ statusCode: 400, message: 'Free plan allows up to 4 team invites' })
  }

  const normalizedAgents = Array.isArray(body.agents) ? body.agents : []
  if (normalizedAgents.length > 12) {
    throw createError({ statusCode: 400, message: 'You can add up to 12 agents during setup' })
  }

  const parsedAgents = normalizedAgents.map((agent, index) => {
    const name = typeof agent?.name === 'string' ? agent.name.trim() : ''
    if (!name) {
      throw createError({ statusCode: 400, message: `Agent #${index + 1} must include a name` })
    }
    if (name.length > 80) {
      throw createError({ statusCode: 400, message: `Agent #${index + 1} name must be 80 characters or fewer` })
    }

    const provider =
      typeof agent?.provider === 'string' ? agent.provider.toLowerCase().trim() : 'openclaw'
    if (!VALID_AGENT_PROVIDERS.has(provider)) {
      throw createError({
        statusCode: 400,
        message: `Agent #${index + 1} provider must be one of: openclaw, cursor, codex, custom`,
      })
    }

    return { name, provider }
  })

  // Check slug collision (unlikely on fresh install but safe)
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: orgSlug }
  })
  if (existingOrg) {
    throw createError({ statusCode: 400, message: 'This organization URL is already taken' })
  }

  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create organization (always FREE)
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
        planTier: 'FREE',
      }
    })

    // 2. Create user
    const user = await tx.user.create({
      data: {
        name: body.user.name,
        email: userEmail,
        passwordHash,
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

    // 4. Create workspace
    const workspaceSlug = body.workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)

    const workspace = await tx.workspace.create({
      data: {
        organizationId: organization.id,
        name: body.workspace.name,
        slug: `${orgSlug}-${workspaceSlug}`,
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

    const createdAgents: Array<{ id: string; name: string; provider: string; apiKey: string }> = []

    for (const agent of parsedAgents) {
      const apiKey = `ctx_${randomBytes(20).toString('hex')}`
      const email = `agent-${slugify(agent.name) || 'agent'}-${randomBytes(4).toString('hex')}@agents.context.local`

      const agentUser = await tx.user.create({
        data: {
          name: agent.name,
          email,
          isAgent: true,
          apiToken: apiKey,
          agentProvider: agent.provider,
          runnerCommand: defaultRunnerCommandForProvider(agent.provider),
        },
      })

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: agentUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      })

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: agentUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      })

      createdAgents.push({
        id: agentUser.id,
        name: agentUser.name ?? agent.name,
        provider: agent.provider,
        apiKey,
      })
    }

    return { organization, workspace, user, createdAgents }
  })

  // Provision default seats (5 internal + 3 external for FREE)
  try {
    await provisionDefaultSeats(result.organization.id, 'FREE')

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

  // Create default channels
  let channels: any[] = []
  try {
    channels = await createDefaultChannels(result.workspace.id, result.user.id)
  } catch (err) {
    console.error('Failed to create default channels:', err)
  }

  // Create invited team members (team mode only)
  const createdTeamMembers: any[] = []
  if (body.mode === 'team' && body.teamEmails && body.teamEmails.length > 0) {
    for (const email of body.teamEmails) {
      try {
        let teamUser = await prisma.user.findUnique({ where: { email } })

        if (!teamUser) {
          const nameFromEmail = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          teamUser = await prisma.user.create({
            data: { email, name: nameFromEmail }
          })
        }

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
      }
    }
  }

  // Seed demo data if requested
  if (body.loadDemoData) {
    try {
      await seedDemoData(result.workspace.id, result.user.id)
    } catch (err) {
      console.error('Failed to seed demo data:', err)
    }
  }

  // Create auth session
  await createSession(event, { id: result.user.id, email: userEmail })

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
    agentApiKeys: result.createdAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      provider: agent.provider,
      apiKey: agent.apiKey,
    })),
  }
})
