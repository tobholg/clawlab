import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')
  
  // Clean existing data
  await prisma.item.deleteMany()
  await prisma.workspaceMember.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.user.deleteMany()
  
  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'elena@relai.io',
        name: 'Elena Rodriguez',
        avatar: 'https://i.pravatar.cc/150?u=elena',
      }
    }),
    prisma.user.create({
      data: {
        email: 'marcus@relai.io',
        name: 'Marcus Johnson',
        avatar: 'https://i.pravatar.cc/150?u=marcus',
      }
    }),
    prisma.user.create({
      data: {
        email: 'sarah@relai.io',
        name: 'Sarah Kim',
        avatar: 'https://i.pravatar.cc/150?u=sarah',
      }
    }),
    prisma.user.create({
      data: {
        email: 'david@relai.io',
        name: 'David Liu',
        avatar: 'https://i.pravatar.cc/150?u=david',
      }
    }),
    prisma.user.create({
      data: {
        email: 'priya@relai.io',
        name: 'Priya Mehta',
        avatar: 'https://i.pravatar.cc/150?u=priya',
      }
    }),
    // Add test user
    prisma.user.create({
      data: {
        email: 'tobholg@gmail.com',
        name: 'Tobias',
        avatar: 'https://i.pravatar.cc/150?u=tobias',
      }
    }),
  ])
  
  const [elena, marcus, sarah, david, priya, tobias] = users
  console.log(`✅ Created ${users.length} users`)
  
  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Relai',
      slug: 'relai',
      description: 'Multi-stakeholder project management',
      members: {
        create: users.map(u => ({
          userId: u.id,
          role: u.id === tobias.id ? 'OWNER' : 'MEMBER',
        }))
      }
    }
  })
  console.log(`✅ Created workspace: ${workspace.name}`)
  
  // Helper to create items
  const createItem = async (data: any) => {
    return prisma.item.create({
      data: {
        workspaceId: workspace.id,
        ...data,
      }
    })
  }
  
  // === ROOT PROJECT ===
  const q4Launch = await createItem({
    title: 'Q4 Product Launch',
    description: 'Ship v2.0 with new features and redesigned UI',
    category: 'Product',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-12-15'),
    confidence: 78,
    assignees: { create: { userId: priya.id } },
    stakeholders: { create: [{ userId: elena.id }, { userId: sarah.id }, { userId: david.id }] },
  })
  console.log(`✅ Created root project: ${q4Launch.title}`)
  
  // === ENGINEERING BRANCH ===
  const engineering = await createItem({
    parentId: q4Launch.id,
    title: 'Engineering',
    description: 'All technical implementation work',
    category: 'Engineering',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-12-01'),
    confidence: 72,
    assignees: { create: { userId: elena.id } },
    stakeholders: { create: { userId: marcus.id } },
  })
  
  const coreApi = await createItem({
    parentId: engineering.id,
    title: 'Core API Development',
    description: 'Build the main API services',
    category: 'Engineering',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-11-15'),
    confidence: 85,
    assignees: { create: { userId: elena.id } },
    stakeholders: { create: { userId: marcus.id } },
  })
  
  const authService = await createItem({
    parentId: coreApi.id,
    title: 'Authentication Service',
    description: 'Magic link auth + session management',
    category: 'Engineering',
    status: 'DONE',
    dueDate: new Date('2024-10-20'),
    confidence: 100,
    assignees: { create: { userId: marcus.id } },
    lastActivityAt: new Date('2024-10-18'),
  })
  
  const paymentIntegration = await createItem({
    parentId: coreApi.id,
    title: 'Payment Integration',
    description: 'Stripe integration for subscriptions',
    category: 'Engineering',
    status: 'BLOCKED',
    dueDate: new Date('2024-11-10'),
    confidence: 45,
    assignees: { create: { userId: marcus.id } },
    stakeholders: { create: { userId: priya.id } },
  })
  
  // Add dependency: payment blocked by auth
  await prisma.itemDependency.create({
    data: {
      blockedItemId: paymentIntegration.id,
      blockingItemId: authService.id,
    }
  })
  
  const websocketService = await createItem({
    parentId: coreApi.id,
    title: 'Websocket Service',
    description: 'Real-time updates for collaborative features',
    category: 'Engineering',
    status: 'TODO',
    dueDate: new Date('2024-11-20'),
    confidence: 70,
    assignees: { create: { userId: elena.id } },
  })
  
  const dbMigration = await createItem({
    parentId: engineering.id,
    title: 'Database Migration',
    description: 'Migrate from SQLite to PostgreSQL',
    category: 'Engineering',
    status: 'DONE',
    dueDate: new Date('2024-10-15'),
    confidence: 100,
    assignees: { create: { userId: marcus.id } },
    lastActivityAt: new Date('2024-10-14'),
  })
  
  const infrastructure = await createItem({
    parentId: engineering.id,
    title: 'Infrastructure Setup',
    description: 'Kubernetes deployment + CI/CD',
    category: 'Engineering',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-11-25'),
    confidence: 80,
    assignees: { create: { userId: elena.id } },
  })
  
  // === DESIGN BRANCH ===
  const design = await createItem({
    parentId: q4Launch.id,
    title: 'Design',
    description: 'UI/UX and visual design',
    category: 'Design',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-11-20'),
    confidence: 88,
    assignees: { create: { userId: sarah.id } },
    stakeholders: { create: { userId: priya.id } },
  })
  
  const designSystem = await createItem({
    parentId: design.id,
    title: 'Design System 2.0',
    description: 'Updated component library and tokens',
    category: 'Design',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-11-01'),
    confidence: 90,
    assignees: { create: { userId: sarah.id } },
    stakeholders: { create: { userId: elena.id } },
  })
  
  const mobileDesigns = await createItem({
    parentId: design.id,
    title: 'Mobile App Designs',
    description: 'Native mobile app UI designs',
    category: 'Design',
    status: 'TODO',
    dueDate: new Date('2024-11-15'),
    confidence: 75,
    assignees: { create: { userId: sarah.id } },
    stakeholders: { create: { userId: david.id } },
  })
  
  // Dependency: mobile designs depend on design system
  await prisma.itemDependency.create({
    data: {
      blockedItemId: mobileDesigns.id,
      blockingItemId: designSystem.id,
    }
  })
  
  const marketingAssets = await createItem({
    parentId: design.id,
    title: 'Marketing Assets',
    description: 'Icons, illustrations, social graphics',
    category: 'Design',
    status: 'DONE',
    dueDate: new Date('2024-10-10'),
    confidence: 100,
    assignees: { create: { userId: sarah.id } },
    stakeholders: { create: { userId: david.id } },
    lastActivityAt: new Date('2024-10-09'),
  })
  
  // === MARKETING BRANCH ===
  const marketing = await createItem({
    parentId: q4Launch.id,
    title: 'Marketing',
    description: 'Launch marketing and communications',
    category: 'Marketing',
    status: 'TODO',
    dueDate: new Date('2024-12-10'),
    confidence: 82,
    assignees: { create: { userId: david.id } },
    stakeholders: { create: { userId: priya.id } },
  })
  
  // Dependency: marketing blocked by design
  await prisma.itemDependency.create({
    data: {
      blockedItemId: marketing.id,
      blockingItemId: design.id,
    }
  })
  
  const launchBlog = await createItem({
    parentId: marketing.id,
    title: 'Launch Blog Post',
    description: 'Announcement blog post for v2.0',
    category: 'Marketing',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-11-25'),
    confidence: 88,
    assignees: { create: { userId: david.id } },
    stakeholders: { create: { userId: priya.id } },
  })
  
  // Dependency: blog needs marketing assets
  await prisma.itemDependency.create({
    data: {
      blockedItemId: launchBlog.id,
      blockingItemId: marketingAssets.id,
    }
  })
  
  const socialCampaign = await createItem({
    parentId: marketing.id,
    title: 'Social Campaign',
    description: 'Twitter/LinkedIn launch campaign',
    category: 'Marketing',
    status: 'TODO',
    dueDate: new Date('2024-12-01'),
    confidence: 75,
    assignees: { create: { userId: david.id } },
  })
  
  // Dependency: social needs blog
  await prisma.itemDependency.create({
    data: {
      blockedItemId: socialCampaign.id,
      blockingItemId: launchBlog.id,
    }
  })
  
  const emailSequence = await createItem({
    parentId: marketing.id,
    title: 'Email Sequence',
    description: 'Drip campaign for existing users',
    category: 'Marketing',
    status: 'TODO',
    dueDate: new Date('2024-12-05'),
    confidence: 80,
    assignees: { create: { userId: david.id } },
  })
  
  console.log('✅ Created all items with hierarchy and dependencies')
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
