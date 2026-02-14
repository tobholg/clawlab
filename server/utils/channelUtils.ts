import { prisma } from './prisma'

/**
 * Slugify a string for use as channel name
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Create default channels for a new workspace (#general, #off-topic)
 */
export async function createDefaultChannels(workspaceId: string, creatorUserId: string) {
  const channels = await prisma.$transaction([
    // Create #general channel
    prisma.channel.create({
      data: {
        workspaceId,
        name: 'general',
        displayName: 'General',
        description: 'Company-wide announcements and discussions',
        type: 'WORKSPACE',
        visibility: 'PUBLIC',
        members: {
          create: {
            userId: creatorUserId,
            role: 'OWNER',
          },
        },
      },
    }),
    // Create #off-topic channel
    prisma.channel.create({
      data: {
        workspaceId,
        name: 'off-topic',
        displayName: 'Off Topic',
        description: 'Non-work conversations and fun stuff',
        type: 'WORKSPACE',
        visibility: 'PUBLIC',
        members: {
          create: {
            userId: creatorUserId,
            role: 'OWNER',
          },
        },
      },
    }),
  ])

  return channels
}

/**
 * Create a channel linked to a project
 */
export async function createProjectChannel(
  projectId: string,
  workspaceId: string,
  projectTitle: string,
  creatorUserId: string
) {
  // Generate unique slug from project title
  let baseName = slugify(projectTitle)
  if (!baseName) baseName = 'project'
  
  let name = baseName
  let suffix = 1
  
  // Ensure unique name within workspace
  while (true) {
    const existing = await prisma.channel.findUnique({
      where: {
        workspaceId_name: { workspaceId, name },
      },
    })
    if (!existing) break
    name = `${baseName}-${suffix}`
    suffix++
  }

  // Find all assignees of the project to auto-add as members
  const projectAssignees = await prisma.itemAssignment.findMany({
    where: { item: { OR: [{ id: projectId }, { projectId }] } },
    select: { userId: true },
  })
  const assigneeUserIds = [...new Set(projectAssignees.map(a => a.userId))]
    .filter(uid => uid !== creatorUserId)

  const channel = await prisma.channel.create({
    data: {
      workspaceId,
      projectId,
      name,
      displayName: projectTitle,
      type: 'PROJECT',
      visibility: 'PUBLIC',
      members: {
        create: [
          { userId: creatorUserId, role: 'OWNER' },
          ...assigneeUserIds.map(uid => ({ userId: uid, role: 'MEMBER' as const })),
        ],
      },
    },
    include: {
      members: {
        include: { user: true },
      },
    },
  })

  return channel
}

/**
 * Add all workspace members to a channel (for inheritMembers)
 */
export async function syncWorkspaceMembersToChannel(channelId: string, workspaceId: string) {
  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: 'ACTIVE' },
  })

  const existingMembers = await prisma.channelMember.findMany({
    where: { channelId },
    select: { userId: true },
  })

  const existingUserIds = new Set(existingMembers.map((m) => m.userId))
  const newMembers = workspaceMembers.filter((m) => !existingUserIds.has(m.userId))

  if (newMembers.length > 0) {
    await prisma.channelMember.createMany({
      data: newMembers.map((m) => ({
        channelId,
        userId: m.userId,
        role: 'MEMBER',
      })),
    })
  }
}
