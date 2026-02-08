import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../utils/auth'
import { checkCanCreateProject } from '../../utils/planLimits'
import { createProjectChannel } from '../../utils/channelUtils'

type TemplateTask = {
  title: string
  description?: string
  category?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  children?: TemplateTask[]
}

type Template = {
  id: string
  name: string
  description: string
  icon: string
  category: string
  tasks: TemplateTask[]
}

const TEMPLATES: Template[] = [
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'End-to-end product launch checklist from research to post-launch review',
    icon: 'heroicons:rocket-launch',
    category: 'Product',
    tasks: [
      { title: 'Market research & validation', category: 'Research', priority: 'HIGH', children: [
        { title: 'Competitive analysis', category: 'Research' },
        { title: 'User interviews (5+)', category: 'Research' },
        { title: 'Define target personas', category: 'Research' },
      ]},
      { title: 'Design & prototyping', category: 'Design', priority: 'HIGH', children: [
        { title: 'Wireframes', category: 'Design' },
        { title: 'Visual design mockups', category: 'Design' },
        { title: 'Prototype & user testing', category: 'Design' },
      ]},
      { title: 'Development', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Core feature implementation', category: 'Engineering' },
        { title: 'API integration', category: 'Engineering' },
        { title: 'QA & bug fixes', category: 'Engineering' },
      ]},
      { title: 'Launch preparation', category: 'Marketing', priority: 'MEDIUM', children: [
        { title: 'Landing page copy', category: 'Marketing' },
        { title: 'Press release & media outreach', category: 'Marketing' },
        { title: 'Email announcement sequence', category: 'Marketing' },
      ]},
      { title: 'Post-launch review', category: 'Operations', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'sprint-cycle',
    name: 'Sprint Cycle',
    description: 'Standard 2-week sprint with planning, execution, and retro',
    icon: 'heroicons:arrow-path-rounded-square',
    category: 'Engineering',
    tasks: [
      { title: 'Sprint planning', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Review backlog & prioritize', category: 'Operations' },
        { title: 'Estimate stories', category: 'Operations' },
        { title: 'Assign owners', category: 'Operations' },
      ]},
      { title: 'Development work', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Feature A', category: 'Engineering' },
        { title: 'Feature B', category: 'Engineering' },
        { title: 'Bug fixes', category: 'Engineering' },
      ]},
      { title: 'Code review & testing', category: 'Engineering', priority: 'HIGH' },
      { title: 'Sprint demo', category: 'Operations', priority: 'MEDIUM' },
      { title: 'Retrospective', category: 'Operations', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    description: 'Multi-channel campaign from strategy through performance analysis',
    icon: 'heroicons:megaphone',
    category: 'Marketing',
    tasks: [
      { title: 'Campaign strategy', category: 'Marketing', priority: 'HIGH', children: [
        { title: 'Define goals & KPIs', category: 'Marketing' },
        { title: 'Target audience segmentation', category: 'Marketing' },
        { title: 'Budget allocation', category: 'Operations' },
      ]},
      { title: 'Content creation', category: 'Marketing', priority: 'HIGH', children: [
        { title: 'Blog posts & articles', category: 'Marketing' },
        { title: 'Social media assets', category: 'Design' },
        { title: 'Email templates', category: 'Marketing' },
        { title: 'Ad creatives', category: 'Design' },
      ]},
      { title: 'Campaign execution', category: 'Marketing', priority: 'HIGH', children: [
        { title: 'Schedule social posts', category: 'Marketing' },
        { title: 'Launch email sequences', category: 'Marketing' },
        { title: 'Activate paid ads', category: 'Marketing' },
      ]},
      { title: 'Performance analysis', category: 'Marketing', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'client-onboarding',
    name: 'Client Onboarding',
    description: 'Structured onboarding flow from welcome to handoff',
    icon: 'heroicons:hand-raised',
    category: 'Operations',
    tasks: [
      { title: 'Welcome & setup', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Send welcome pack', category: 'Operations' },
        { title: 'Provision accounts & access', category: 'Engineering' },
        { title: 'Schedule kickoff call', category: 'Operations' },
      ]},
      { title: 'Discovery & requirements', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Gather business requirements', category: 'Operations' },
        { title: 'Document current workflows', category: 'Operations' },
        { title: 'Define success criteria', category: 'Operations' },
      ]},
      { title: 'Configuration & customization', category: 'Engineering', priority: 'MEDIUM', children: [
        { title: 'Configure platform settings', category: 'Engineering' },
        { title: 'Data migration', category: 'Engineering' },
        { title: 'Integrations setup', category: 'Engineering' },
      ]},
      { title: 'Training & handoff', category: 'Operations', priority: 'MEDIUM', children: [
        { title: 'User training sessions', category: 'Operations' },
        { title: 'Documentation & guides', category: 'Operations' },
        { title: 'Go-live support', category: 'Operations' },
      ]},
    ]
  },
  {
    id: 'bug-bash',
    name: 'Bug Bash',
    description: 'Coordinated bug hunting and fixing session',
    icon: 'heroicons:bug-ant',
    category: 'Engineering',
    tasks: [
      { title: 'Preparation', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Define scope & focus areas', category: 'Engineering' },
        { title: 'Set up test environments', category: 'Engineering' },
        { title: 'Create bug report template', category: 'Engineering' },
      ]},
      { title: 'Bug hunting', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Critical path testing', category: 'Engineering' },
        { title: 'Edge case exploration', category: 'Engineering' },
        { title: 'Cross-browser testing', category: 'Engineering' },
        { title: 'Mobile testing', category: 'Engineering' },
      ]},
      { title: 'Triage & prioritize', category: 'Engineering', priority: 'HIGH' },
      { title: 'Fix & verify', category: 'Engineering', priority: 'HIGH' },
      { title: 'Regression testing', category: 'Engineering', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'platform-migration',
    name: 'Platform Migration',
    description: 'Migrate systems with minimal downtime and risk',
    icon: 'heroicons:server-stack',
    category: 'Engineering',
    tasks: [
      { title: 'Assessment & planning', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Audit current system', category: 'Engineering' },
        { title: 'Define migration strategy', category: 'Engineering' },
        { title: 'Risk assessment', category: 'Engineering' },
        { title: 'Create rollback plan', category: 'Engineering' },
      ]},
      { title: 'Data migration', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Schema mapping', category: 'Engineering' },
        { title: 'Data transformation scripts', category: 'Engineering' },
        { title: 'Test migration (dry run)', category: 'Engineering' },
      ]},
      { title: 'Application migration', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Deploy to new platform', category: 'Engineering' },
        { title: 'Integration testing', category: 'Engineering' },
        { title: 'Performance benchmarking', category: 'Engineering' },
      ]},
      { title: 'Cutover & validation', category: 'Operations', priority: 'CRITICAL' },
      { title: 'Post-migration monitoring', category: 'Engineering', priority: 'HIGH' },
    ]
  },
  {
    id: 'design-system',
    name: 'Design System',
    description: 'Build a reusable component library and design tokens',
    icon: 'heroicons:paint-brush',
    category: 'Design',
    tasks: [
      { title: 'Foundations', category: 'Design', priority: 'HIGH', children: [
        { title: 'Color palette & tokens', category: 'Design' },
        { title: 'Typography scale', category: 'Design' },
        { title: 'Spacing & layout grid', category: 'Design' },
        { title: 'Icon set', category: 'Design' },
      ]},
      { title: 'Core components', category: 'Design', priority: 'HIGH', children: [
        { title: 'Buttons & CTAs', category: 'Design' },
        { title: 'Form inputs', category: 'Design' },
        { title: 'Cards & containers', category: 'Design' },
        { title: 'Navigation components', category: 'Design' },
      ]},
      { title: 'Documentation', category: 'Operations', priority: 'MEDIUM', children: [
        { title: 'Usage guidelines', category: 'Operations' },
        { title: 'Component storybook', category: 'Engineering' },
        { title: 'Contribution guide', category: 'Operations' },
      ]},
    ]
  },
  {
    id: 'hiring-pipeline',
    name: 'Hiring Pipeline',
    description: 'Structure the hiring process from job posting to offer',
    icon: 'heroicons:user-group',
    category: 'Operations',
    tasks: [
      { title: 'Job definition', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Write job description', category: 'Operations' },
        { title: 'Define interview rubric', category: 'Operations' },
        { title: 'Set compensation range', category: 'Operations' },
      ]},
      { title: 'Sourcing', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Post to job boards', category: 'Operations' },
        { title: 'Employee referral outreach', category: 'Operations' },
        { title: 'Direct sourcing', category: 'Operations' },
      ]},
      { title: 'Interview process', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Phone screens', category: 'Operations' },
        { title: 'Technical interviews', category: 'Engineering' },
        { title: 'Culture fit interviews', category: 'Operations' },
        { title: 'Final panel', category: 'Operations' },
      ]},
      { title: 'Offer & close', category: 'Operations', priority: 'HIGH' },
    ]
  },
]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // If requesting template list (requires auth but not workspace)
  if (body?.listTemplates) {
    const { requireUser } = await import('../../utils/auth')
    await requireUser(event)
    return TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      taskCount: t.tasks.reduce((sum, task) => sum + 1 + (task.children?.length || 0), 0),
    }))
  }

  const { templateId, workspaceId, title } = body

  if (!templateId || !workspaceId) {
    throw createError({ statusCode: 400, message: 'templateId and workspaceId are required' })
  }

  const template = TEMPLATES.find(t => t.id === templateId)
  if (!template) {
    throw createError({ statusCode: 400, message: 'Template not found' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'MEMBER')
  const user = auth.user

  // Enforce plan limit
  const check = await checkCanCreateProject(workspaceId)
  if (!check.allowed) {
    throw createError({
      statusCode: 403,
      message: `Project limit reached (${check.current}/${check.limit}). Upgrade your plan to create more projects.`,
    })
  }

  const projectTitle = title || template.name

  // Create the project
  const project = await prisma.item.create({
    data: {
      workspaceId,
      title: projectTitle,
      description: template.description,
      ownerId: user.id,
      status: 'IN_PROGRESS',
      startDate: new Date(),
    }
  })

  // Create tasks and subtasks
  for (const task of template.tasks) {
    const createdTask = await prisma.item.create({
      data: {
        workspaceId,
        parentId: project.id,
        projectId: project.id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority || 'MEDIUM',
        status: 'TODO',
      }
    })

    if (task.children?.length) {
      for (const subtask of task.children) {
        await prisma.item.create({
          data: {
            workspaceId,
            parentId: createdTask.id,
            projectId: project.id,
            title: subtask.title,
            description: subtask.description,
            category: subtask.category,
            priority: subtask.priority || 'MEDIUM',
            status: 'TODO',
          }
        })
      }
    }
  }

  // Create project channel
  try {
    await createProjectChannel(project.id, workspaceId, projectTitle, user.id)
  } catch (e) {
    console.error('Failed to create project channel:', e)
    // Non-critical, don't fail the request
  }

  // Create activity
  await prisma.activity.create({
    data: {
      itemId: project.id,
      userId: user.id,
      type: 'CREATED',
      metadata: { fromTemplate: templateId },
    }
  })

  return {
    id: project.id,
    title: project.title,
    templateName: template.name,
  }
})
