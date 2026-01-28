import { prisma } from './prisma'
import type { ItemStatus } from '@prisma/client'

const DEMO_TEAM = [
  { name: 'Sarah Chen', avatar: null, email: 'sarah.chen@demo.relai.app' },
  { name: 'Marcus Johnson', avatar: null, email: 'marcus.j@demo.relai.app' },
  { name: 'Elena Rodriguez', avatar: null, email: 'elena.r@demo.relai.app' },
  { name: 'Alex Kim', avatar: null, email: 'alex.kim@demo.relai.app' },
  { name: 'Jordan Taylor', avatar: null, email: 'jordan.t@demo.relai.app' },
  { name: 'Priya Sharma', avatar: null, email: 'priya.s@demo.relai.app' },
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

export async function seedDemoData(workspaceId: string, ownerId: string): Promise<void> {
  // Create demo team members
  const teamMembers = await Promise.all(
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

  // Add team members to workspace
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

  // All available assignees
  const allAssignees = [ownerId, ...teamMembers.map(m => m.id)]

  // Project configurations
  const projects: ProjectConfig[] = [
    {
      title: 'Q4 Product Launch',
      description: 'Major product update launching before end of quarter. Includes new AI features, improved onboarding, and enterprise integrations.',
      status: 'IN_PROGRESS',
      progress: 45,
      confidence: 72,
      startDate: daysAgo(30),
      dueDate: daysFromNow(45),
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
          children: [
            { title: 'API v2 implementation', category: 'Engineering', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'Real-time sync engine', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'review', progress: 85, confidence: 90, startDate: daysAgo(14), dueDate: daysFromNow(5) },
            { title: 'Database migration scripts', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 40, confidence: 75, startDate: daysAgo(7), dueDate: daysFromNow(14) },
            { title: 'Performance optimization', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(25) },
            { title: 'Security audit fixes', category: 'Engineering', status: 'BLOCKED', subStatus: 'external', progress: 20, confidence: 50, description: 'Waiting for penetration test report from external firm' },
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
          children: [
            { title: 'New onboarding flow mockups', category: 'Design', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'Component library updates', category: 'Design', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'Enterprise dashboard design', category: 'Design', status: 'IN_PROGRESS', subStatus: 'review', progress: 80, confidence: 90, startDate: daysAgo(10), dueDate: daysFromNow(3) },
            { title: 'Mobile responsive layouts', category: 'Design', status: 'IN_PROGRESS', subStatus: 'active', progress: 30, confidence: 75, startDate: daysAgo(3), dueDate: daysFromNow(12) },
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
          children: [
            { title: 'Launch announcement draft', category: 'Marketing', status: 'IN_PROGRESS', subStatus: 'active', progress: 60, confidence: 80, startDate: daysAgo(7), dueDate: daysFromNow(10) },
            { title: 'Product demo video', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60, dueDate: daysFromNow(30) },
            { title: 'Press kit preparation', category: 'Marketing', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(35) },
          ]
        },
        {
          title: 'Documentation',
          category: 'Product',
          status: 'TODO',
          subStatus: 'backlog',
          progress: 0,
          confidence: 60,
          dueDate: daysFromNow(38),
          children: [
            { title: 'API documentation update', category: 'Product', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 65 },
            { title: 'User guides for new features', category: 'Product', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60 },
            { title: 'Migration guide', category: 'Product', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55 },
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
      items: [
        {
          title: 'Infrastructure',
          category: 'Engineering',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 50,
          confidence: 70,
          startDate: daysAgo(55),
          dueDate: daysFromNow(60),
          children: [
            { title: 'Kubernetes cluster setup', category: 'Engineering', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'CI/CD pipeline migration', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 70, confidence: 85, startDate: daysAgo(20), dueDate: daysFromNow(10) },
            { title: 'Database replication setup', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'scoping', progress: 20, confidence: 55, startDate: daysAgo(5), dueDate: daysFromNow(40) },
            { title: 'Monitoring & alerting', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 70, dueDate: daysFromNow(50) },
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
          children: [
            { title: 'Schema mapping', category: 'Engineering', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'ETL pipeline development', category: 'Engineering', status: 'PAUSED', subStatus: 'on_hold', progress: 30, confidence: 50 },
            { title: 'Data validation scripts', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 40 },
          ]
        },
        {
          title: 'Testing & QA',
          category: 'Engineering',
          status: 'TODO',
          subStatus: 'backlog',
          progress: 0,
          confidence: 50,
          dueDate: daysFromNow(80),
          children: [
            { title: 'Load testing plan', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60 },
            { title: 'Regression test suite', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 55 },
            { title: 'Failover testing', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 45 },
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
          children: [
            { title: 'Swift UI migration', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 40, confidence: 70, startDate: daysAgo(10), dueDate: daysFromNow(30) },
            { title: 'Offline sync implementation', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 50, dueDate: daysFromNow(60) },
            { title: 'Push notification overhaul', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 65, dueDate: daysFromNow(80) },
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
          children: [
            { title: 'Jetpack Compose migration', category: 'Engineering', status: 'IN_PROGRESS', subStatus: 'active', progress: 35, confidence: 65, startDate: daysAgo(8), dueDate: daysFromNow(35) },
            { title: 'Room database refactor', category: 'Engineering', status: 'TODO', subStatus: 'ready', progress: 0, confidence: 55, dueDate: daysFromNow(50) },
            { title: 'Background sync service', category: 'Engineering', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 45, dueDate: daysFromNow(70) },
          ]
        },
        {
          title: 'UX Research',
          category: 'Design',
          status: 'IN_PROGRESS',
          subStatus: 'active',
          progress: 60,
          confidence: 80,
          startDate: daysAgo(14),
          dueDate: daysFromNow(10),
          children: [
            { title: 'User interviews', category: 'Design', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'Competitive analysis', category: 'Design', status: 'DONE', progress: 100, confidence: 100 },
            { title: 'Prototype testing', category: 'Design', status: 'IN_PROGRESS', subStatus: 'active', progress: 50, confidence: 75, startDate: daysAgo(5), dueDate: daysFromNow(10) },
          ]
        },
        {
          title: 'App Store Preparation',
          category: 'Marketing',
          status: 'TODO',
          subStatus: 'backlog',
          progress: 0,
          confidence: 70,
          dueDate: daysFromNow(110),
          children: [
            { title: 'App store screenshots', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 75 },
            { title: 'App description copy', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 80 },
            { title: 'Preview video', category: 'Marketing', status: 'TODO', subStatus: 'backlog', progress: 0, confidence: 60 },
          ]
        },
      ]
    },
  ]

  // Create projects and their nested items
  for (const projectConfig of projects) {
    const project = await prisma.item.create({
      data: {
        workspaceId,
        title: projectConfig.title,
        description: projectConfig.description,
        status: projectConfig.status,
        progress: projectConfig.progress,
        confidence: projectConfig.confidence,
        startDate: projectConfig.startDate,
        dueDate: projectConfig.dueDate,
        lastActivityAt: daysAgo(Math.floor(Math.random() * 3)),
      }
    })

    // Assign 2-3 random people to project
    const projectAssignees = shuffleArray(allAssignees).slice(0, 2 + Math.floor(Math.random() * 2))
    await Promise.all(
      projectAssignees.map(userId =>
        prisma.itemAssignment.create({
          data: { itemId: project.id, userId }
        })
      )
    )

    // Create top-level items (sections)
    for (const sectionConfig of projectConfig.items) {
      const section = await prisma.item.create({
        data: {
          workspaceId,
          parentId: project.id,
          title: sectionConfig.title,
          description: sectionConfig.description,
          category: sectionConfig.category,
          status: sectionConfig.status,
          subStatus: sectionConfig.subStatus,
          progress: sectionConfig.progress,
          confidence: sectionConfig.confidence,
          startDate: sectionConfig.startDate,
          dueDate: sectionConfig.dueDate,
          lastActivityAt: daysAgo(Math.floor(Math.random() * 5)),
        }
      })

      // Assign 1-2 random people to section
      const sectionAssignees = shuffleArray(allAssignees).slice(0, 1 + Math.floor(Math.random() * 2))
      await Promise.all(
        sectionAssignees.map(userId =>
          prisma.itemAssignment.create({
            data: { itemId: section.id, userId }
          })
        )
      )

      // Create child tasks
      if (sectionConfig.children) {
        for (const taskConfig of sectionConfig.children) {
          const task = await prisma.item.create({
            data: {
              workspaceId,
              parentId: section.id,
              title: taskConfig.title,
              description: taskConfig.description,
              category: taskConfig.category,
              status: taskConfig.status,
              subStatus: taskConfig.subStatus,
              progress: taskConfig.progress,
              confidence: taskConfig.confidence,
              startDate: taskConfig.startDate,
              dueDate: taskConfig.dueDate,
              lastActivityAt: daysAgo(Math.floor(Math.random() * 7)),
            }
          })

          // Assign 1 random person to task
          const taskAssignee = shuffleArray(allAssignees)[0]
          await prisma.itemAssignment.create({
            data: { itemId: task.id, userId: taskAssignee }
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
        }
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
  }

  // Add some dependencies between items
  const allItems = await prisma.item.findMany({
    where: { workspaceId },
    select: { id: true, title: true, parentId: true }
  })

  // Find some items to create dependencies
  const apiItem = allItems.find(i => i.title.includes('API v2'))
  const docItem = allItems.find(i => i.title.includes('API documentation'))
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
