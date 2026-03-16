import { prisma } from './prisma'
import type { FocusActivityType, FocusEndReason, FocusLane, ItemComplexity, ItemPriority, ItemStatus } from '@prisma/client'

const DEMO_TEAM = [
  { name: 'Sarah Chen', avatar: null, email: 'sarah.chen@example.com' },
  { name: 'Marcus Johnson', avatar: null, email: 'marcus.j@example.com' },
  { name: 'Elena Rodriguez', avatar: null, email: 'elena.r@example.com' },
  { name: 'Alex Kim', avatar: null, email: 'alex.kim@example.com' },
  { name: 'Jordan Taylor', avatar: null, email: 'jordan.t@example.com' },
  { name: 'Priya Sharma', avatar: null, email: 'priya.s@example.com' },
]

interface ProjectConfig {
  title: string
  description: string
  status: ItemStatus
  progress: number
  confidence: number
  startDate: Date
  dueDate: Date
  category?: string
  complexity?: ItemComplexity
  priority?: ItemPriority
  items: ItemConfig[]
}

interface ItemConfig {
  title: string
  description?: string
  category: string
  status: ItemStatus
  subStatus?: string
  progress: number
  confidence: number
  startDate?: Date
  dueDate?: Date
  complexity?: ItemComplexity
  priority?: ItemPriority
  children?: ItemConfig[]
}

// Helper to create date relative to today
function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(days: number): Date {
  return daysFromNow(-days)
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600000)
}

function completedAtFor(status: ItemStatus, dueDate?: Date): Date | undefined {
  if (status !== 'DONE') return undefined
  if (dueDate) {
    const d = new Date(dueDate)
    d.setDate(d.getDate() - 1)
    return d
  }
  return daysAgo(2)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

async function ensureUniqueChannelName(workspaceId: string, baseName: string): Promise<string> {
  let name = baseName || 'project'
  let suffix = 1

  while (true) {
    const existing = await prisma.channel.findUnique({
      where: { workspaceId_name: { workspaceId, name } }
    })
    if (!existing) break
    name = `${baseName}-${suffix}`
    suffix++
  }

  return name
}

function logSeedError(step: string, err: unknown) {
  console.error(`[demo seed] ${step}`, err)
}

async function createManySkipDuplicatesCompat<T>(ops: {
  data: T[]
  createMany: (args: { data: T[]; skipDuplicates: true }) => Promise<unknown>
  createOne: (args: { data: T }) => Promise<unknown>
}) {
  if (!ops.data.length) return

  if (process.env.DATABASE_URL) {
    await ops.createMany({ data: ops.data, skipDuplicates: true })
    return
  }

  await Promise.all(
    ops.data.map(async (entry) => {
      try {
        await ops.createOne({ data: entry })
      } catch (err: any) {
        if (err?.code === 'P2002') return
        throw err
      }
    })
  )
}

export async function seedDemoData(workspaceId: string, ownerId: string): Promise<void> {
  // Look up workspace's organization for org membership + seats
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })
  const organizationId = workspace.organizationId

  // Create demo team members
  let teamMembers: Array<{ id: string }> = []
  try {
    teamMembers = await Promise.all(
      DEMO_TEAM.map(member =>
        prisma.user.create({
          data: {
            name: member.name,
            email: member.email,
            avatar: member.avatar,
          }
        })
      )
    )
  } catch (err) {
    logSeedError('create demo users', err)
    throw err
  }

  // Add team members to organization
  try {
    await createManySkipDuplicatesCompat({
      data: teamMembers.map(member => ({
        organizationId,
        userId: member.id,
        role: 'MEMBER' as const,
      })),
      createMany: (args) => prisma.organizationMember.createMany(args),
      createOne: (args) => prisma.organizationMember.create(args),
    })
  } catch (err) {
    logSeedError('add demo users to organization', err)
    // Non-fatal: continue even if org membership fails
  }

  // Add team members to workspace
  try {
    await Promise.all(
      teamMembers.map(member =>
        prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId: member.id,
            role: 'MEMBER',
          }
        })
      )
    )
  } catch (err) {
    logSeedError('add demo users to workspace', err)
    throw err
  }

  // Occupy available seats for demo team members
  try {
    for (const member of teamMembers) {
      const seat = await prisma.seat.findFirst({
        where: { organizationId, type: 'INTERNAL', status: 'AVAILABLE' },
      })
      if (seat) {
        await prisma.seat.update({
          where: { id: seat.id },
          data: { status: 'OCCUPIED', userId: member.id, occupiedAt: new Date() },
        })
      }
    }
  } catch (err) {
    logSeedError('occupy seats for demo users', err)
    // Non-fatal: continue even if seat allocation fails
  }

  // All available assignees
  const allAssignees = [ownerId, ...teamMembers.map(m => m.id)]

  // Project configurations
  const projects: ProjectConfig[] = [
    {
      title: 'Q4 Product Launch',
      description: 'Major product update launching before end of quarter. Includes new AI features, improved onboarding, and enterprise integrations.',
      status: 'IN_PROGRESS',
      progress: 52,
      confidence: 74,
      startDate: daysAgo(30),
      dueDate: daysFromNow(45),
      category: 'Product',
      complexity: 'EPIC',
      priority: 'HIGH',
      items: [
        {
          title: 'Engineering',
          category: 'Engineering',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 55,
          confidence: 80,
          startDate: daysAgo(28),
          dueDate: daysFromNow(30),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'API v2 implementation', category: 'Engineering', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(6), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Real-time sync engine', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'review', progress: 85, confidence: 90, startDate: daysAgo(14), dueDate: daysFromNow(5), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Database migration scripts', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 40, confidence: 75, startDate: daysAgo(7), dueDate: daysFromNow(14), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Performance optimization', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(25), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Security audit fixes', category: 'Bug', status: 'BLOCKED', subStatus: 'external', progress: 20, confidence: 50, description: 'Waiting for penetration test report from external firm', dueDate: daysFromNow(12), complexity: 'SMALL', priority: 'CRITICAL' },
          ]
        },
        {
          title: 'Design',
          category: 'Design',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 65,
          confidence: 85,
          startDate: daysAgo(25),
          dueDate: daysFromNow(20),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'New onboarding flow mockups', category: 'Design', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(4), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Component library updates', category: 'Design', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(8), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Enterprise dashboard design', category: 'Design', status: 'IN_PROGRESS', subStatus: 'review', progress: 80, confidence: 90, startDate: daysAgo(10), dueDate: daysFromNow(3), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Mobile responsive layouts', category: 'Design', status: 'IN_PROGRESS', subStatus: 'active', progress: 30, confidence: 75, startDate: daysAgo(3), dueDate: daysFromNow(12), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Accessibility pass', category: 'Design', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(18), complexity: 'SMALL', priority: 'HIGH' },
          ]
        },
        {
          title: 'Marketing',
          category: 'Marketing',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 25,
          confidence: 65,
          startDate: daysAgo(10),
          dueDate: daysFromNow(40),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'Launch announcement draft', category: 'Marketing', status: 'IN_PROGRESS', subStatus: 'active', progress: 60, confidence: 80, startDate: daysAgo(7), dueDate: daysFromNow(10), complexity: 'SMALL', priority: 'HIGH' },
            { title: 'Product demo video', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(30), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Press kit preparation', category: 'Marketing', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(35), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Customer webinar plan', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, dueDate: daysFromNow(28), complexity: 'SMALL', priority: 'LOW' },
          ]
        },
        {
          title: 'Product',
          category: 'Product',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 35,
          confidence: 70,
          startDate: daysAgo(12),
          dueDate: daysFromNow(38),
          complexity: 'MEDIUM',
          priority: 'HIGH',
          children: [
            { title: 'Release notes outline', category: 'Product', status: 'IN_PROGRESS', subStatus: 'active', progress: 45, confidence: 75, startDate: daysAgo(4), dueDate: daysFromNow(14), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Pricing and packaging review', category: 'Product', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(32), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Feature flag rollout plan', category: 'Product', status: 'IN_PROGRESS', subStatus: 'review', progress: 70, confidence: 80, startDate: daysAgo(6), dueDate: daysFromNow(20), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Migration guide', category: 'Product', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, dueDate: daysFromNow(40), complexity: 'LARGE', priority: 'MEDIUM' },
          ]
        },
        {
          title: 'QA',
          category: 'QA',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 40,
          confidence: 68,
          startDate: daysAgo(9),
          dueDate: daysFromNow(28),
          complexity: 'MEDIUM',
          priority: 'HIGH',
          children: [
            { title: 'End-to-end regression suite', category: 'QA', status: 'IN_PROGRESS', subStatus: 'active', progress: 35, confidence: 70, startDate: daysAgo(5), dueDate: daysFromNow(16), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Bug bash #1', category: 'QA', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(9), complexity: 'SMALL', priority: 'HIGH' },
            { title: 'Performance benchmarks', category: 'QA', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, dueDate: daysFromNow(22), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Accessibility audit', category: 'QA', status: 'BLOCKED', subStatus: 'decision', progress: 0, confidence: 45, dueDate: daysFromNow(15), complexity: 'SMALL', priority: 'HIGH' },
          ]
        },
        {
          title: 'Operations',
          category: 'Operations',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 30,
          confidence: 62,
          startDate: daysAgo(6),
          dueDate: daysFromNow(33),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'Launch readiness checklist', category: 'Operations', status: 'IN_PROGRESS', subStatus: 'active', progress: 40, confidence: 70, startDate: daysAgo(3), dueDate: daysFromNow(21), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Support playbook update', category: 'Operations', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(18), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Incident response rotation', category: 'Operations', status: 'PAUSED', subStatus: 'deprioritized', progress: 10, confidence: 40, dueDate: daysFromNow(35), complexity: 'SMALL', priority: 'LOW' },
            { title: 'Data retention policy review', category: 'Operations', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, dueDate: daysFromNow(27), complexity: 'SMALL', priority: 'LOW' },
          ]
        },
      ]
    },
    {
      title: 'Platform Migration',
      description: 'Infrastructure modernization project. Moving from legacy systems to cloud-native architecture.',
      status: 'IN_PROGRESS',
      progress: 35,
      confidence: 60,
      startDate: daysAgo(60),
      dueDate: daysFromNow(90),
      category: 'Operations',
      complexity: 'EPIC',
      priority: 'HIGH',
      items: [
        {
          title: 'Infrastructure',
          category: 'Operations',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 50,
          confidence: 70,
          startDate: daysAgo(55),
          dueDate: daysFromNow(60),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'Kubernetes cluster setup', category: 'Operations', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(20), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'CI/CD pipeline migration', category: 'Operations', status: 'IN_PROGRESS', subStatus: 'active', progress: 70, confidence: 85, startDate: daysAgo(20), dueDate: daysFromNow(10), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Database replication setup', category: 'Operations', status: 'IN_PROGRESS', subStatus: 'scoping', progress: 20, confidence: 55, startDate: daysAgo(5), dueDate: daysFromNow(40), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Monitoring and alerting', category: 'Operations', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(50), complexity: 'MEDIUM', priority: 'MEDIUM' },
          ]
        },
        {
          title: 'Data Migration',
          category: 'Engineering',
          status: 'PAUSED',
          subStatus: 'on_hold',
          progress: 15,
          confidence: 45,
          description: 'On hold pending infrastructure completion',
          startDate: daysAgo(30),
          dueDate: daysFromNow(70),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'Schema mapping', category: 'Engineering', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(25), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'ETL pipeline development', category: 'Engineering', status: 'PAUSED', subStatus: 'on_hold', progress: 30, confidence: 50, dueDate: daysFromNow(40), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Data validation scripts', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 40, dueDate: daysFromNow(45), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Cutover rehearsal plan', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 50, dueDate: daysFromNow(55), complexity: 'SMALL', priority: 'HIGH' },
          ]
        },
        {
          title: 'Research',
          category: 'Research',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 30,
          confidence: 65,
          startDate: daysAgo(14),
          dueDate: daysFromNow(45),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'Vendor evaluation matrix', category: 'Research', status: 'IN_PROGRESS', subStatus: 'active', progress: 45, confidence: 70, startDate: daysAgo(6), dueDate: daysFromNow(20), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Latency benchmarking study', category: 'Research', status: 'IN_PROGRESS', subStatus: 'review', progress: 65, confidence: 75, startDate: daysAgo(4), dueDate: daysFromNow(18), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Disaster recovery tabletop', category: 'Research', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(30), complexity: 'SMALL', priority: 'MEDIUM' },
          ]
        },
        {
          title: 'QA',
          category: 'QA',
          status: 'TODO',
          subStatus: 'backlog',
          progress: 0,
          confidence: 50,
          dueDate: daysFromNow(80),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'Load testing plan', category: 'QA', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(40), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Regression test suite', category: 'QA', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, dueDate: daysFromNow(55), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Failover testing', category: 'QA', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 45, dueDate: daysFromNow(60), complexity: 'MEDIUM', priority: 'HIGH' },
          ]
        },
        {
          title: 'Bug Triage',
          category: 'Bug',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 20,
          confidence: 58,
          startDate: daysAgo(8),
          dueDate: daysFromNow(25),
          complexity: 'SMALL',
          priority: 'HIGH',
          children: [
            { title: 'Legacy auth edge cases', category: 'Bug', status: 'IN_PROGRESS', subStatus: 'active', progress: 35, confidence: 60, startDate: daysAgo(4), dueDate: daysFromNow(12), complexity: 'SMALL', priority: 'HIGH' },
            { title: 'Backup job failures', category: 'Bug', status: 'BLOCKED', subStatus: 'dependency', progress: 10, confidence: 40, dueDate: daysFromNow(14), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Data sync inconsistencies', category: 'Bug', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 50, dueDate: daysFromNow(24), complexity: 'MEDIUM', priority: 'MEDIUM' },
          ]
        },
      ]
    },
    {
      title: 'Mobile App v2',
      description: 'Complete redesign of the mobile application with offline support and improved performance.',
      status: 'IN_PROGRESS',
      progress: 20,
      confidence: 55,
      startDate: daysAgo(14),
      dueDate: daysFromNow(120),
      category: 'Product',
      complexity: 'EPIC',
      priority: 'HIGH',
      items: [
        {
          title: 'iOS Development',
          category: 'Engineering',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 25,
          confidence: 60,
          startDate: daysAgo(12),
          dueDate: daysFromNow(100),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'Swift UI migration', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 40, confidence: 70, startDate: daysAgo(10), dueDate: daysFromNow(30), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Offline sync implementation', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 50, dueDate: daysFromNow(60), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Push notification overhaul', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 65, dueDate: daysFromNow(80), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Crash reporting cleanup', category: 'Bug', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(45), complexity: 'SMALL', priority: 'HIGH' },
          ]
        },
        {
          title: 'Android Development',
          category: 'Engineering',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 20,
          confidence: 55,
          startDate: daysAgo(10),
          dueDate: daysFromNow(105),
          complexity: 'LARGE',
          priority: 'HIGH',
          children: [
            { title: 'Jetpack Compose migration', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 35, confidence: 65, startDate: daysAgo(8), dueDate: daysFromNow(35), complexity: 'LARGE', priority: 'HIGH' },
            { title: 'Room database refactor', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 55, dueDate: daysFromNow(50), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Background sync service', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 45, dueDate: daysFromNow(70), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Play Store compliance update', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(55), complexity: 'SMALL', priority: 'MEDIUM' },
          ]
        },
        {
          title: 'UX Research',
          category: 'Research',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 60,
          confidence: 80,
          startDate: daysAgo(14),
          dueDate: daysFromNow(10),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'User interviews', category: 'Research', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(6), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Competitive analysis', category: 'Research', status: 'DONE', progress: 100, confidence: 100, dueDate: daysAgo(10), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Prototype testing', category: 'Research', status: 'IN_PROGRESS', subStatus: 'active', progress: 50, confidence: 75, startDate: daysAgo(5), dueDate: daysFromNow(10), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Accessibility research', category: 'Research', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(20), complexity: 'SMALL', priority: 'MEDIUM' },
          ]
        },
        {
          title: 'QA',
          category: 'QA',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 30,
          confidence: 65,
          startDate: daysAgo(6),
          dueDate: daysFromNow(35),
          complexity: 'MEDIUM',
          priority: 'HIGH',
          children: [
            { title: 'TestFlight beta pass', category: 'QA', status: 'IN_PROGRESS', subStatus: 'active', progress: 45, confidence: 70, startDate: daysAgo(2), dueDate: daysFromNow(14), complexity: 'SMALL', priority: 'HIGH' },
            { title: 'Android device lab matrix', category: 'QA', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(25), complexity: 'MEDIUM', priority: 'MEDIUM' },
            { title: 'Offline mode test cases', category: 'QA', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(28), complexity: 'MEDIUM', priority: 'HIGH' },
          ]
        },
        {
          title: 'Growth',
          category: 'Marketing',
          status: 'TODO',
          subStatus: 'backlog',
          progress: 0,
          confidence: 70,
          dueDate: daysFromNow(110),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'App store screenshots', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 75, complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'App description copy', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 80, complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Preview video', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, complexity: 'MEDIUM', priority: 'LOW' },
            { title: 'Launch email sequence', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55, complexity: 'SMALL', priority: 'LOW' },
          ]
        },
        {
          title: 'Operations',
          category: 'Operations',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 35,
          confidence: 62,
          startDate: daysAgo(7),
          dueDate: daysFromNow(40),
          complexity: 'MEDIUM',
          priority: 'MEDIUM',
          children: [
            { title: 'Beta rollout plan', category: 'Operations', status: 'IN_PROGRESS', subStatus: 'active', progress: 55, confidence: 70, startDate: daysAgo(3), dueDate: daysFromNow(22), complexity: 'MEDIUM', priority: 'HIGH' },
            { title: 'Support escalation flow', category: 'Operations', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 60, dueDate: daysFromNow(35), complexity: 'SMALL', priority: 'MEDIUM' },
            { title: 'Analytics instrumentation audit', category: 'Operations', status: 'IN_PROGRESS', subStatus: 'review', progress: 50, confidence: 65, startDate: daysAgo(2), dueDate: daysFromNow(18), complexity: 'MEDIUM', priority: 'HIGH' },
          ]
        },
      ]
    },
  ]

  // Create projects and their nested items
  for (const projectConfig of projects) {
    try {
      const project = await prisma.item.create({
        data: {
          workspaceId,
          title: projectConfig.title,
          description: projectConfig.description,
          category: projectConfig.category,
          status: projectConfig.status,
          progress: projectConfig.progress,
          confidence: projectConfig.confidence,
          complexity: projectConfig.complexity,
          priority: projectConfig.priority,
          startDate: projectConfig.startDate,
          dueDate: projectConfig.dueDate,
          completedAt: completedAtFor(projectConfig.status, projectConfig.dueDate),
          lastActivityAt: daysAgo(Math.floor(Math.random() * 3)),
        }
      })

      // Assign 2-3 random people to project, first one is owner
      const projectAssignees = shuffleArray(allAssignees).slice(0, 2 + Math.floor(Math.random() * 2))
      await Promise.all(
        projectAssignees.map(userId =>
          prisma.itemAssignment.create({
            data: { itemId: project.id, userId }
          })
        )
      )
      // Set first assignee as owner
      await prisma.item.update({
        where: { id: project.id },
        data: { ownerId: projectAssignees[0] }
      })

      // Create top-level items (sections)
      for (const sectionConfig of projectConfig.items) {
        try {
          const section = await prisma.item.create({
            data: {
              workspaceId,
              parentId: project.id,
              projectId: project.id,
              title: sectionConfig.title,
              description: sectionConfig.description,
              category: sectionConfig.category,
              status: sectionConfig.status,
              subStatus: sectionConfig.subStatus,
              progress: sectionConfig.progress,
              confidence: sectionConfig.confidence,
              complexity: sectionConfig.complexity,
              priority: sectionConfig.priority,
              startDate: sectionConfig.startDate,
              dueDate: sectionConfig.dueDate,
              completedAt: completedAtFor(sectionConfig.status, sectionConfig.dueDate),
              lastActivityAt: daysAgo(Math.floor(Math.random() * 5)),
            }
          })

          // Assign 1-2 random people to section, first one is owner
          const sectionAssignees = shuffleArray(allAssignees).slice(0, 1 + Math.floor(Math.random() * 2))
          await Promise.all(
            sectionAssignees.map(userId =>
              prisma.itemAssignment.create({
                data: { itemId: section.id, userId }
              })
            )
          )
          // Set first assignee as owner
          await prisma.item.update({
            where: { id: section.id },
            data: { ownerId: sectionAssignees[0] }
          })

          // Create child tasks
          if (sectionConfig.children) {
            for (const taskConfig of sectionConfig.children) {
              try {
                const task = await prisma.item.create({
                  data: {
                    workspaceId,
                    parentId: section.id,
                    projectId: project.id,
                    title: taskConfig.title,
                    description: taskConfig.description,
                    category: taskConfig.category,
                    status: taskConfig.status,
                    subStatus: taskConfig.subStatus,
                    progress: taskConfig.progress,
                    confidence: taskConfig.confidence,
                    complexity: taskConfig.complexity,
                    priority: taskConfig.priority,
                    startDate: taskConfig.startDate,
                    dueDate: taskConfig.dueDate,
                    completedAt: completedAtFor(taskConfig.status, taskConfig.dueDate),
                    lastActivityAt: daysAgo(Math.floor(Math.random() * 7)),
                  }
                })

                // Assign 1 random person to task and set as owner
                const taskAssignee = shuffleArray(allAssignees)[0]
                await prisma.itemAssignment.create({
                  data: { itemId: task.id, userId: taskAssignee }
                })
                // Set owner
                await prisma.item.update({
                  where: { id: task.id },
                  data: { ownerId: taskAssignee }
                })

                // Add some comments to in-progress tasks
                if (taskConfig.status === 'IN_PROGRESS' && Math.random() > 0.5) {
                  const commenter = shuffleArray(allAssignees)[0]
                  await prisma.comment.create({
                    data: {
                      itemId: task.id,
                      userId: commenter,
                      content: getRandomComment(),
                    }
                  })
                }
              } catch (err) {
                logSeedError(`seed task "${taskConfig.title}" in "${sectionConfig.title}"`, err)
                throw err
              }
            }
          }
        } catch (err) {
          logSeedError(`seed section "${sectionConfig.title}" in "${projectConfig.title}"`, err)
          throw err
        }
      }

      // Add a few activities to the project
      const activityUser = shuffleArray(allAssignees)[0]
      await prisma.activity.create({
        data: {
          itemId: project.id,
          userId: activityUser,
          type: 'PROGRESS_UPDATE',
          oldValue: String(projectConfig.progress - 10),
          newValue: String(projectConfig.progress),
        }
      })
    } catch (err) {
      logSeedError(`seed project "${projectConfig.title}"`, err)
      throw err
    }
  }

  // Add some dependencies between items
  let allItems: Array<{ id: string; title: string; parentId: string | null; projectId: string | null }> = []
  try {
    allItems = await prisma.item.findMany({
      where: { workspaceId },
      select: { id: true, title: true, parentId: true, projectId: true }
    })

    // Find some items to create dependencies
    const apiItem = allItems.find(i => i.title.includes('API v2'))
    const docItem = allItems.find(i => i.title.includes('Migration guide'))
    const dbMigration = allItems.find(i => i.title.includes('Database migration'))
    const etlPipeline = allItems.find(i => i.title.includes('ETL pipeline'))

    if (apiItem && docItem) {
      await prisma.itemDependency.create({
        data: { blockedItemId: docItem.id, blockingItemId: apiItem.id }
      })
    }

    if (dbMigration && etlPipeline) {
      await prisma.itemDependency.create({
        data: { blockedItemId: etlPipeline.id, blockingItemId: dbMigration.id }
      })
    }
  } catch (err) {
    logSeedError('seed dependencies', err)
  }

  const rootProjects = allItems.filter(item => !item.parentId)
  const primaryProject = rootProjects.find(item => item.title === 'Q4 Product Launch') || rootProjects[0]
  const productSection = primaryProject
    ? allItems.find(item => item.parentId === primaryProject.id && item.title === 'Product')
    : null
  const operationsSection = primaryProject
    ? allItems.find(item => item.parentId === primaryProject.id && item.title === 'Operations')
    : null
  const engineeringSection = primaryProject
    ? allItems.find(item => item.parentId === primaryProject.id && item.title === 'Engineering')
    : null
  const qaSection = primaryProject
    ? allItems.find(item => item.parentId === primaryProject.id && item.title === 'QA')
    : null

  // Add stakeholders to key items
  const stakeholderTargets = [
    allItems.find(item => item.title === 'Feature flag rollout plan'),
    allItems.find(item => item.title === 'Launch readiness checklist'),
    allItems.find(item => item.title === 'End-to-end regression suite'),
    allItems.find(item => item.title === 'Latency benchmarking study'),
  ].filter(Boolean) as Array<{ id: string }>

  if (stakeholderTargets.length) {
    const stakeholderData = [
      { itemId: stakeholderTargets[0]?.id, userId: teamMembers[1].id },
      { itemId: stakeholderTargets[1]?.id, userId: teamMembers[2].id },
      { itemId: stakeholderTargets[2]?.id, userId: teamMembers[3].id },
      { itemId: stakeholderTargets[3]?.id, userId: teamMembers[4].id },
    ].filter(entry => entry.itemId)

    if (stakeholderData.length) {
      await createManySkipDuplicatesCompat({
        data: stakeholderData as Array<{ itemId: string; userId: string }>,
        createMany: (args) => prisma.itemStakeholder.createMany(args),
        createOne: (args) => prisma.itemStakeholder.create(args),
      })
    }
  }

  // Documents and versions
  if (primaryProject) {
    try {
      const launchDoc = await prisma.document.create({
        data: {
          itemId: primaryProject.id,
          projectId: primaryProject.id,
          title: 'Launch Plan',
          content: [
            '# Launch Plan',
            '',
            '## Goals',
            '- Deliver AI features with stable performance',
            '- Improve onboarding conversion by 15 percent',
            '- Ensure enterprise readiness and compliance',
            '',
            '## Timeline',
            '- Internal beta: Week 1',
            '- Customer preview: Week 3',
            '- General availability: Week 6',
          ].join('\n'),
          createdById: ownerId,
          lastEditedById: teamMembers[0].id,
        }
      })

      await prisma.documentVersion.createMany({
        data: [
          {
            documentId: launchDoc.id,
            title: launchDoc.title,
            content: launchDoc.content,
            label: 'v1',
            notes: 'Initial plan draft',
            type: 'MAJOR',
            createdById: ownerId,
            createdAt: daysAgo(7),
          },
          {
            documentId: launchDoc.id,
            title: launchDoc.title,
            content: `${launchDoc.content}\n\n## Risk Register\n- Security audit delays\n- Mobile release dependency\n`,
            label: 'v1.1',
            notes: 'Added risk register',
            type: 'MINOR',
            createdById: teamMembers[0].id,
            createdAt: daysAgo(3),
          },
        ]
      })

      if (qaSection) {
        const qaDoc = await prisma.document.create({
          data: {
            itemId: qaSection.id,
            projectId: primaryProject.id,
            title: 'QA Test Plan',
            content: [
              '# QA Test Plan',
              '',
              '## Scope',
              '- Regression suite',
              '- Performance benchmarks',
              '- Accessibility audit',
              '',
              '## Ownership',
              '- QA lead: Elena',
              '- Support: Engineering',
            ].join('\n'),
            createdById: teamMembers[1].id,
            lastEditedById: teamMembers[2].id,
          }
        })

        await prisma.documentVersion.create({
          data: {
            documentId: qaDoc.id,
            title: qaDoc.title,
            content: qaDoc.content,
            label: 'v1',
            notes: 'Initial QA plan',
            type: 'MAJOR',
            createdById: teamMembers[1].id,
            createdAt: daysAgo(4),
          }
        })
      }
    } catch (err) {
      logSeedError('seed documents', err)
    }
  }

  // External stakeholders and inbound workflow
  if (primaryProject) {
    try {
      const externalUsers = await Promise.all([
        prisma.user.upsert({
          where: { email: 'maya.patel@acme.demo' },
          update: { name: 'Maya Patel', avatar: null },
          create: { name: 'Maya Patel', email: 'maya.patel@acme.demo', avatar: null },
        }),
        prisma.user.upsert({
          where: { email: 'liam.oconnor@acme.demo' },
          update: { name: 'Liam OConnor', avatar: null },
          create: { name: 'Liam OConnor', email: 'liam.oconnor@acme.demo', avatar: null },
        }),
      ])

      let externalSpace = await prisma.externalSpace.findFirst({
        where: { projectId: primaryProject.id, slug: 'acme' }
      })

      if (!externalSpace) {
        externalSpace = await prisma.externalSpace.create({
          data: {
            projectId: primaryProject.id,
            name: 'Acme Corp',
            slug: 'acme',
            description: 'Customer stakeholder portal for launch updates and requests.',
            allowTaskSubmission: true,
            maxIRsPer24h: 6,
          }
        })
      }

      await createManySkipDuplicatesCompat({
        data: [
          {
            userId: externalUsers[0].id,
            externalSpaceId: externalSpace.id,
            displayName: 'Maya Patel',
            position: 'VP Product',
            invitedBy: ownerId,
            canSubmitTasks: true,
            maxIRsPer24h: 5,
          },
          {
            userId: externalUsers[1].id,
            externalSpaceId: externalSpace.id,
            displayName: 'Liam OConnor',
            position: 'Director of IT',
            invitedBy: ownerId,
            canSubmitTasks: true,
            maxIRsPer24h: 4,
          },
        ],
        createMany: (args) => prisma.stakeholderAccess.createMany(args),
        createOne: (args) => prisma.stakeholderAccess.create(args),
      })

      const inboundParentId = productSection?.id ?? primaryProject.id
      const suggestionTask = await prisma.item.create({
        data: {
          workspaceId,
          parentId: inboundParentId,
          projectId: primaryProject.id,
          title: 'Stakeholder analytics dashboard',
          description: 'Provide a customer-facing summary of adoption and feature usage trends.',
          category: 'Product',
          status: 'TODO',
          subStatus: 'ready',
          progress: 0,
          confidence: 60,
          complexity: 'MEDIUM',
          priority: 'HIGH',
          startDate: daysAgo(2),
          dueDate: daysFromNow(32),
          lastActivityAt: daysAgo(1),
          ownerId: teamMembers[0].id,
          assignees: {
            create: { userId: teamMembers[0].id }
          },
        }
      })

      const suggestionIR = await prisma.informationRequest.create({
        data: {
          externalSpaceId: externalSpace.id,
          createdById: externalUsers[0].id,
          type: 'SUGGESTION',
          content: 'Can we add a dashboard that summarizes adoption across teams and highlights ROI?',
          status: 'ACCEPTED',
          response: 'Yes, we have accepted this. We will include an analytics dashboard in the launch scope.',
          respondedById: ownerId,
          respondedAt: daysAgo(2),
          votes: [externalUsers[1].id],
          convertedToTaskId: suggestionTask.id,
          addedToAIContext: true,
        }
      })

      const questionIR = await prisma.informationRequest.create({
        data: {
          externalSpaceId: externalSpace.id,
          createdById: externalUsers[1].id,
          type: 'QUESTION',
          content: 'What is the expected timeline for SSO availability and rollout?',
          status: 'ANSWERED',
          response: 'Targeting preview in week 4 with GA in week 7. We will share a pilot plan next week.',
          respondedById: teamMembers[0].id,
          respondedAt: daysAgo(1),
          votes: [externalUsers[0].id],
        }
      })

      await prisma.externalComment.createMany({
        data: [
          {
            informationRequestId: suggestionIR.id,
            authorId: externalUsers[1].id,
            isTeamMember: false,
            content: 'Glad to hear this was accepted. Happy to share requirements.',
            createdAt: daysAgo(1),
          },
          {
            informationRequestId: questionIR.id,
            authorId: ownerId,
            isTeamMember: true,
            content: 'We will follow up with a detailed rollout checklist by end of week.',
            createdAt: hoursAgo(18),
          },
        ]
      })

      const externalTaskParentId = operationsSection?.id ?? engineeringSection?.id ?? primaryProject.id
      const externalTaskItem = await prisma.item.create({
        data: {
          workspaceId,
          parentId: externalTaskParentId,
          projectId: primaryProject.id,
          title: 'SAML SSO integration',
          description: 'Support SAML 2.0 SSO with Okta and Azure AD.',
          category: 'Engineering',
          status: 'IN_PROGRESS',
          subStatus: 'scoping',
          progress: 20,
          confidence: 55,
          complexity: 'LARGE',
          priority: 'HIGH',
          startDate: daysAgo(3),
          dueDate: daysFromNow(40),
          lastActivityAt: daysAgo(1),
          ownerId: teamMembers[1].id,
          assignees: {
            create: { userId: teamMembers[1].id }
          },
        }
      })

      const externalTask = await prisma.externalTask.create({
        data: {
          externalSpaceId: externalSpace.id,
          submittedById: externalUsers[1].id,
          title: 'SSO support for enterprise',
          description: 'Please add SSO support and document the rollout plan.',
          status: 'ACCEPTED',
          linkedTaskId: externalTaskItem.id,
          internalNotes: 'Track against enterprise commitments for Q4 launch.',
        }
      })

      await prisma.externalComment.create({
        data: {
          externalTaskId: externalTask.id,
          authorId: teamMembers[2].id,
          isTeamMember: true,
          content: 'We are scoping this now and will share requirements next week.',
          createdAt: hoursAgo(12),
        }
      })

      await prisma.aIContextDoc.create({
        data: {
          projectId: primaryProject.id,
          title: 'Stakeholder FAQ',
          content: [
            '## Stakeholder FAQ',
            '',
            '- SSO availability: preview in week 4',
            '- Data retention: 30 days by default',
            '- Support SLAs: 24 hour response for enterprise',
          ].join('\n'),
          addedById: ownerId,
          addedAt: daysAgo(5),
        }
      })
    } catch (err) {
      logSeedError('seed external stakeholder data', err)
    }
  }

  // === CREATE CHANNELS WITH MESSAGES AND THREADS ===
  
  // Find or create general channel (may already exist from onboarding)
  let generalChannel: { id: string } | null = null
  try {
    generalChannel = await prisma.channel.findFirst({
      where: { workspaceId, name: 'general' }
    })
    
    if (!generalChannel) {
      generalChannel = await prisma.channel.create({
        data: {
          workspaceId,
          name: 'general',
          displayName: 'General',
          description: 'Company-wide announcements and discussions',
          type: 'WORKSPACE',
          visibility: 'PUBLIC',
          members: {
            create: allAssignees.map(userId => ({
              userId,
              role: userId === ownerId ? 'OWNER' : 'MEMBER',
            }))
          }
        }
      })
    } else {
      // Add team members to existing channel
      for (const userId of allAssignees) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: generalChannel.id, userId } },
          update: {},
          create: { channelId: generalChannel.id, userId, role: userId === ownerId ? 'OWNER' : 'MEMBER' }
        })
      }
    }
  } catch (err) {
    logSeedError('seed general channel', err)
  }

  // Find or create off-topic/watercooler channel
  let randomChannel: { id: string } | null = null
  try {
    randomChannel = await prisma.channel.findFirst({
      where: { workspaceId, name: { in: ['off-topic', 'watercooler'] } }
    })
    
    if (!randomChannel) {
      randomChannel = await prisma.channel.create({
        data: {
          workspaceId,
          name: 'watercooler',
          displayName: 'Watercooler',
          description: 'Off-topic chat and random fun',
          type: 'WORKSPACE',
          visibility: 'PUBLIC',
          members: {
            create: allAssignees.map(userId => ({
              userId,
              role: userId === ownerId ? 'OWNER' : 'MEMBER',
            }))
          }
        }
      })
    } else {
      // Add team members to existing channel
      for (const userId of allAssignees) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: randomChannel.id, userId } },
          update: {},
          create: { channelId: randomChannel.id, userId, role: 'MEMBER' }
        })
      }
    }
  } catch (err) {
    logSeedError('seed watercooler channel', err)
  }

  // Sample messages for general channel
  if (!generalChannel) {
    logSeedError('seed general channel messages', new Error('general channel missing'))
  } else {
    try {
      const generalMessages = [
        { content: "Hey team! Quick reminder that we have our weekly standup tomorrow at 10am. Please come prepared with your updates.", userId: ownerId },
        { content: "Thanks for the heads up! I'll have the API documentation ready to share.", userId: teamMembers[0].id },
        { content: "Can we also discuss the timeline for the mobile app? I have some concerns about the current estimates.", userId: teamMembers[1].id },
        { content: "Good point @Elena. Let's add that to the agenda.", userId: ownerId },
        { content: "Just pushed the new design system components to staging. Would love some feedback! 🎨", userId: teamMembers[2].id },
        { content: "These look great! The new color palette is much more consistent.", userId: teamMembers[3].id },
        { content: "Agreed, nice work! The button hover states are 👌", userId: teamMembers[0].id },
        { content: "Quick update: the database migration is complete. All tests passing ✅", userId: teamMembers[4].id },
        { content: "Awesome! That unblocks the ETL pipeline work. I'll start on that today.", userId: teamMembers[1].id },
        { content: "FYI - I'll be OOO Friday for a dentist appointment. Back online by 2pm.", userId: teamMembers[5].id },
      ]

      // Create messages with some time spread
      const createdMessages: any[] = []
      for (let i = 0; i < generalMessages.length; i++) {
        const msg = generalMessages[i]
        const message = await prisma.message.create({
          data: {
            channelId: generalChannel.id,
            userId: msg.userId,
            content: msg.content,
            createdAt: new Date(Date.now() - (generalMessages.length - i) * 3600000), // Spread over hours
          }
        })
        createdMessages.push(message)
      }

      // Add a thread to one of the messages (the design system one)
      const designMessage = createdMessages[4] // "Just pushed the new design system..."
      const threadReplies = [
        { content: "I particularly like the new card components. Very clean!", userId: teamMembers[0].id },
        { content: "Thanks! I spent extra time on the shadows and spacing.", userId: teamMembers[2].id },
        { content: "Should we document these in Storybook?", userId: teamMembers[1].id },
        { content: "Already on it! Should be up by EOD.", userId: teamMembers[2].id },
        { content: "Perfect 🙌", userId: ownerId },
      ]

      for (let i = 0; i < threadReplies.length; i++) {
        const reply = threadReplies[i]
        await prisma.message.create({
          data: {
            channelId: generalChannel.id,
            userId: reply.userId,
            content: reply.content,
            parentId: designMessage.id,
            createdAt: new Date(Date.now() - (threadReplies.length - i) * 600000), // Spread over minutes
          }
        })
      }

      // Add some reactions
      await prisma.reaction.create({
        data: { messageId: createdMessages[4].id, userId: teamMembers[0].id, emoji: '🎨' }
      })
      await prisma.reaction.create({
        data: { messageId: createdMessages[4].id, userId: teamMembers[3].id, emoji: '👍' }
      })
      await prisma.reaction.create({
        data: { messageId: createdMessages[4].id, userId: ownerId, emoji: '🔥' }
      })
      await prisma.reaction.create({
        data: { messageId: createdMessages[7].id, userId: teamMembers[0].id, emoji: '🎉' }
      })
      await prisma.reaction.create({
        data: { messageId: createdMessages[7].id, userId: teamMembers[2].id, emoji: '✅' }
      })
    } catch (err) {
      logSeedError('seed general channel messages', err)
    }
  }

  // Watercooler messages
  if (!randomChannel) {
    logSeedError('seed watercooler messages', new Error('watercooler channel missing'))
  } else {
    try {
      const watercoolerMessages = [
        { content: "Anyone else watching the new season of that sci-fi show? No spoilers but WOW 🤯", userId: teamMembers[3].id },
        { content: "YES! The plot twist in episode 3 was insane", userId: teamMembers[5].id },
        { content: "I'm still on episode 1, please no spoilers! 😅", userId: teamMembers[0].id },
        { content: "My lips are sealed 🤐", userId: teamMembers[3].id },
        { content: "Lunch recommendation: the new Thai place on 5th is amazing", userId: teamMembers[1].id },
        { content: "Ooh good to know! I've been looking for good Thai food around here", userId: ownerId },
        { content: "Their pad see ew is incredible. Trust me.", userId: teamMembers[1].id },
        { content: "Friday team trivia is back! Who's in? 🧠", userId: teamMembers[4].id },
        { content: "Count me in!", userId: teamMembers[2].id },
        { content: "Same! Let's defend our title 🏆", userId: teamMembers[0].id },
      ]

      for (let i = 0; i < watercoolerMessages.length; i++) {
        const msg = watercoolerMessages[i]
        await prisma.message.create({
          data: {
            channelId: randomChannel.id,
            userId: msg.userId,
            content: msg.content,
            createdAt: new Date(Date.now() - (watercoolerMessages.length - i) * 7200000),
          }
        })
      }
    } catch (err) {
      logSeedError('seed watercooler messages', err)
    }
  }

  // Project channels with activity
  try {
    if (rootProjects.length > 0) {
      for (const project of rootProjects) {
        let projectChannel = await prisma.channel.findFirst({
          where: { projectId: project.id }
        })

        if (!projectChannel) {
          const baseName = slugify(project.title)
          const channelName = await ensureUniqueChannelName(workspaceId, baseName)

          projectChannel = await prisma.channel.create({
            data: {
              workspaceId,
              projectId: project.id,
              name: channelName,
              displayName: project.title,
              description: `Project updates and coordination for ${project.title}`,
              type: 'PROJECT',
              visibility: 'PUBLIC',
              members: {
                create: allAssignees.map(userId => ({
                  userId,
                  role: userId === ownerId ? 'OWNER' : 'MEMBER',
                }))
              }
            }
          })
        } else {
          for (const userId of allAssignees) {
            await prisma.channelMember.upsert({
              where: { channelId_userId: { channelId: projectChannel.id, userId } },
              update: {},
              create: { channelId: projectChannel.id, userId, role: userId === ownerId ? 'OWNER' : 'MEMBER' }
            })
          }
        }

        const projectMessages = [
          { content: `Weekly check-in for ${project.title}. Please post blockers here.`, userId: ownerId },
          { content: "Drafted the latest status update. Will share in the doc shortly.", userId: teamMembers[0].id },
          { content: "Working through the scoping items now. Expect a timeline by end of day.", userId: teamMembers[1].id },
          { content: "QA is lining up test coverage for the next milestone.", userId: teamMembers[4].id },
        ]

        const createdProjectMessages: any[] = []
        for (let i = 0; i < projectMessages.length; i++) {
          const msg = projectMessages[i]
          const message = await prisma.message.create({
            data: {
              channelId: projectChannel.id,
              userId: msg.userId,
              content: msg.content,
              createdAt: new Date(Date.now() - (projectMessages.length - i) * 5400000),
            }
          })
          createdProjectMessages.push(message)
        }

        const threadRoot = createdProjectMessages[1]
        if (threadRoot) {
          await prisma.message.createMany({
            data: [
              {
                channelId: projectChannel.id,
                userId: teamMembers[2].id,
                content: 'Thanks, I will add the design notes here once finalized.',
                parentId: threadRoot.id,
                createdAt: hoursAgo(6),
              },
              {
                channelId: projectChannel.id,
                userId: ownerId,
                content: 'Great. Lets keep the status summary concise for stakeholders.',
                parentId: threadRoot.id,
                createdAt: hoursAgo(5),
              },
            ]
          })
        }
      }
    }
  } catch (err) {
    logSeedError('seed project channels/messages', err)
  }

  // Focus sessions and current focus states
  try {
    const focusTasks = {
      owner: allItems.find(item => item.title === 'Real-time sync engine')
        || allItems.find(item => item.title === 'TestFlight beta pass')
        || allItems.find(item => item.title === 'CI/CD pipeline migration'),
      design: allItems.find(item => item.title === 'Enterprise dashboard design')
        || allItems.find(item => item.title === 'Accessibility pass'),
      infra: allItems.find(item => item.title === 'CI/CD pipeline migration')
        || allItems.find(item => item.title === 'Monitoring and alerting'),
      qa: allItems.find(item => item.title === 'Bug bash #1')
        || allItems.find(item => item.title === 'End-to-end regression suite'),
    }

    if (primaryProject && focusTasks.owner) {
      await prisma.user.update({
        where: { id: ownerId },
        data: {
          currentProjectFocusId: primaryProject.id,
          currentTaskFocusId: focusTasks.owner.id,
          currentLaneFocus: null,
          currentActivityStart: hoursAgo(2),
        }
      })
    }

    if (primaryProject && focusTasks.design) {
      await prisma.user.update({
        where: { id: teamMembers[0].id },
        data: {
          currentProjectFocusId: primaryProject.id,
          currentTaskFocusId: focusTasks.design.id,
          currentLaneFocus: null,
          currentActivityStart: hoursAgo(1.2),
        }
      })
    }

    if (primaryProject && focusTasks.infra) {
      await prisma.user.update({
        where: { id: teamMembers[1].id },
        data: {
          currentProjectFocusId: primaryProject.id,
          currentTaskFocusId: focusTasks.infra.id,
          currentLaneFocus: null,
          currentActivityStart: hoursAgo(1.8),
        }
      })
    }

    await prisma.user.update({
      where: { id: teamMembers[2].id },
      data: {
        currentProjectFocusId: primaryProject.id,
        currentTaskFocusId: null,
        currentLaneFocus: 'MEETING' as FocusLane,
        currentActivityStart: hoursAgo(1),
      }
    })

    const focusSessionData: Array<{
      userId: string
      startedAt: Date
      endedAt?: Date
      activityType: FocusActivityType
      taskId?: string | null
      lane?: FocusLane | null
      projectId?: string | null
      endReason?: FocusEndReason | null
      comment?: string | null
      commentedAt?: Date | null
    }> = []

    if (primaryProject && focusTasks.owner) {
      focusSessionData.push(
        {
          userId: ownerId,
          startedAt: hoursAgo(3),
          endedAt: hoursAgo(2),
          activityType: 'TASK' as FocusActivityType,
          taskId: focusTasks.owner.id,
          projectId: primaryProject.id,
          endReason: 'SWITCHED' as FocusEndReason,
          comment: 'Paused to review stakeholder feedback.',
          commentedAt: hoursAgo(2),
        },
        {
          userId: ownerId,
          startedAt: hoursAgo(2),
          activityType: 'TASK' as FocusActivityType,
          taskId: focusTasks.owner.id,
          projectId: primaryProject.id,
        }
      )
    }

    if (primaryProject && focusTasks.design) {
      focusSessionData.push({
        userId: teamMembers[0].id,
        startedAt: hoursAgo(2.6),
        endedAt: hoursAgo(1.2),
        activityType: 'TASK' as FocusActivityType,
        taskId: focusTasks.design.id,
        projectId: primaryProject.id,
        endReason: 'COMPLETED' as FocusEndReason,
        comment: 'Wrapped initial review notes.',
        commentedAt: hoursAgo(1.2),
      })
    }

    if (primaryProject && focusTasks.infra) {
      focusSessionData.push({
        userId: teamMembers[1].id,
        startedAt: hoursAgo(3.4),
        endedAt: hoursAgo(1.8),
        activityType: 'TASK' as FocusActivityType,
        taskId: focusTasks.infra.id,
        projectId: primaryProject.id,
        endReason: 'SWITCHED' as FocusEndReason,
        comment: 'Switching to incident follow-up.',
        commentedAt: hoursAgo(1.8),
      })
    }

    if (primaryProject) {
      focusSessionData.push({
        userId: teamMembers[2].id,
        startedAt: hoursAgo(1.5),
        activityType: 'LANE' as FocusActivityType,
        lane: 'MEETING' as FocusLane,
        projectId: primaryProject.id,
      })
    }

    if (primaryProject && focusTasks.qa) {
      focusSessionData.push({
        userId: teamMembers[4].id,
        startedAt: hoursAgo(4.2),
        endedAt: hoursAgo(2.7),
        activityType: 'TASK' as FocusActivityType,
        taskId: focusTasks.qa.id,
        projectId: primaryProject.id,
        endReason: 'MANUAL_EXIT' as FocusEndReason,
        comment: 'Paused for bug triage.',
        commentedAt: hoursAgo(2.7),
      })
    }

    if (focusSessionData.length > 0) {
      await prisma.focusSession.createMany({ data: focusSessionData })
    }
  } catch (err) {
    logSeedError('seed focus sessions', err)
  }
}

// Helper functions
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const COMMENTS = [
  "Making good progress on this. Should be done by end of week.",
  "Hit a small snag but working through it.",
  "This is taking longer than expected - might need to revise the estimate.",
  "Dependencies resolved, unblocked now!",
  "Pushed initial implementation, ready for review.",
  "Added some unit tests, coverage looks good.",
  "Need to sync with the design team on this one.",
  "Found a cleaner approach, refactoring now.",
  "This is going smoothly, ahead of schedule.",
  "Waiting on feedback before proceeding further.",
]

function getRandomComment(): string {
  return COMMENTS[Math.floor(Math.random() * COMMENTS.length)]
}
