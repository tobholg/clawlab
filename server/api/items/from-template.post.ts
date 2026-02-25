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
  group: 'general' | 'specific'
  tasks: TemplateTask[]
}

const TEMPLATES: Template[] = [
  // ── General templates ──────────────────────────────
  {
    id: 'software-development',
    name: 'Software Development',
    description: 'Organize features, bugs, tech debt, and releases in one project',
    icon: 'heroicons:code-bracket',
    category: 'Engineering',
    group: 'general',
    tasks: [
      { title: 'Features', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Feature 1', category: 'Engineering' },
        { title: 'Feature 2', category: 'Engineering' },
        { title: 'Feature 3', category: 'Engineering' },
      ]},
      { title: 'Bugs', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Bug 1', category: 'Engineering' },
        { title: 'Bug 2', category: 'Engineering' },
      ]},
      { title: 'Tech Debt', category: 'Engineering', priority: 'MEDIUM', children: [
        { title: 'Refactor 1', category: 'Engineering' },
        { title: 'Refactor 2', category: 'Engineering' },
      ]},
      { title: 'Infrastructure', category: 'Engineering', priority: 'MEDIUM' },
      { title: 'Documentation', category: 'Engineering', priority: 'LOW' },
    ]
  },
  {
    id: 'creative-production',
    name: 'Creative Production',
    description: 'Manage briefs, assets, reviews, and deliverables for creative work',
    icon: 'heroicons:paint-brush',
    category: 'Design',
    group: 'general',
    tasks: [
      { title: 'Briefs & Requirements', category: 'Design', priority: 'HIGH', children: [
        { title: 'Brief 1', category: 'Design' },
        { title: 'Brief 2', category: 'Design' },
      ]},
      { title: 'In Production', category: 'Design', priority: 'HIGH', children: [
        { title: 'Asset 1', category: 'Design' },
        { title: 'Asset 2', category: 'Design' },
        { title: 'Asset 3', category: 'Design' },
      ]},
      { title: 'Review & Feedback', category: 'Design', priority: 'MEDIUM' },
      { title: 'Final Deliverables', category: 'Design', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'content-pipeline',
    name: 'Content Pipeline',
    description: 'Plan, draft, review, and publish content across channels',
    icon: 'heroicons:document-text',
    category: 'Marketing',
    group: 'general',
    tasks: [
      { title: 'Content Ideas', category: 'Marketing', priority: 'MEDIUM', children: [
        { title: 'Topic 1', category: 'Marketing' },
        { title: 'Topic 2', category: 'Marketing' },
        { title: 'Topic 3', category: 'Marketing' },
      ]},
      { title: 'Drafting', category: 'Marketing', priority: 'HIGH', children: [
        { title: 'Draft 1', category: 'Marketing' },
        { title: 'Draft 2', category: 'Marketing' },
      ]},
      { title: 'Review & Editing', category: 'Marketing', priority: 'HIGH' },
      { title: 'Scheduled / Published', category: 'Marketing', priority: 'MEDIUM' },
      { title: 'Performance Tracking', category: 'Marketing', priority: 'LOW' },
    ]
  },
  {
    id: 'consulting-engagement',
    name: 'Consulting Engagement',
    description: 'Structure client work from discovery through delivery and follow-up',
    icon: 'heroicons:briefcase',
    category: 'Operations',
    group: 'general',
    tasks: [
      { title: 'Discovery', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Stakeholder interviews', category: 'Operations' },
        { title: 'Current state assessment', category: 'Operations' },
        { title: 'Requirements gathering', category: 'Operations' },
      ]},
      { title: 'Analysis & Recommendations', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Data analysis', category: 'Operations' },
        { title: 'Findings report', category: 'Operations' },
        { title: 'Recommendation deck', category: 'Operations' },
      ]},
      { title: 'Implementation Support', category: 'Operations', priority: 'MEDIUM' },
      { title: 'Handoff & Follow-up', category: 'Operations', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'product-roadmap',
    name: 'Product Roadmap',
    description: 'Organize product initiatives by quarter with research, design, and delivery',
    icon: 'heroicons:map',
    category: 'Product',
    group: 'general',
    tasks: [
      { title: 'Research & Discovery', category: 'Research', priority: 'HIGH', children: [
        { title: 'User research', category: 'Research' },
        { title: 'Market analysis', category: 'Research' },
        { title: 'Opportunity sizing', category: 'Research' },
      ]},
      { title: 'Design & Validation', category: 'Design', priority: 'HIGH', children: [
        { title: 'Concepts & wireframes', category: 'Design' },
        { title: 'Prototype testing', category: 'Design' },
        { title: 'Spec finalization', category: 'Design' },
      ]},
      { title: 'Build & Ship', category: 'Engineering', priority: 'HIGH', children: [
        { title: 'Development', category: 'Engineering' },
        { title: 'QA & testing', category: 'Engineering' },
        { title: 'Release', category: 'Engineering' },
      ]},
      { title: 'Measure & Iterate', category: 'Product', priority: 'MEDIUM' },
    ]
  },
  {
    id: 'operations-workflow',
    name: 'Operations Workflow',
    description: 'Track recurring operational tasks, processes, and improvements',
    icon: 'heroicons:cog-6-tooth',
    category: 'Operations',
    group: 'general',
    tasks: [
      { title: 'Daily Operations', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Task 1', category: 'Operations' },
        { title: 'Task 2', category: 'Operations' },
        { title: 'Task 3', category: 'Operations' },
      ]},
      { title: 'Process Improvements', category: 'Operations', priority: 'MEDIUM', children: [
        { title: 'Improvement 1', category: 'Operations' },
        { title: 'Improvement 2', category: 'Operations' },
      ]},
      { title: 'Vendor & Tools', category: 'Operations', priority: 'LOW' },
      { title: 'Reporting & Metrics', category: 'Operations', priority: 'MEDIUM' },
    ]
  },

  // ── Specific templates ─────────────────────────────
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'End-to-end product launch checklist from research to post-launch review',
    icon: 'heroicons:rocket-launch',
    category: 'Product',
    group: 'specific',
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
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    description: 'Multi-channel campaign from strategy through performance analysis',
    icon: 'heroicons:megaphone',
    category: 'Marketing',
    group: 'specific',
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
    group: 'specific',
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
    id: 'platform-migration',
    name: 'Platform Migration',
    description: 'Migrate systems with minimal downtime and risk',
    icon: 'heroicons:server-stack',
    category: 'Engineering',
    group: 'specific',
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
    id: 'hiring-pipeline',
    name: 'Hiring Pipeline',
    description: 'Structure the hiring process from job posting to offer',
    icon: 'heroicons:user-group',
    category: 'Operations',
    group: 'specific',
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
  {
    id: 'event-planning',
    name: 'Event Planning',
    description: 'Plan and execute events from venue booking to post-event wrap-up',
    icon: 'heroicons:calendar-days',
    category: 'Operations',
    group: 'specific',
    tasks: [
      { title: 'Venue & logistics', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Book venue', category: 'Operations' },
        { title: 'Catering arrangements', category: 'Operations' },
        { title: 'AV & equipment setup', category: 'Operations' },
      ]},
      { title: 'Program & speakers', category: 'Operations', priority: 'HIGH', children: [
        { title: 'Confirm speakers', category: 'Operations' },
        { title: 'Finalize agenda', category: 'Operations' },
        { title: 'Prepare materials', category: 'Design' },
      ]},
      { title: 'Promotion', category: 'Marketing', priority: 'MEDIUM', children: [
        { title: 'Email invitations', category: 'Marketing' },
        { title: 'Social media promotion', category: 'Marketing' },
        { title: 'Registration page', category: 'Marketing' },
      ]},
      { title: 'Day-of execution', category: 'Operations', priority: 'CRITICAL' },
      { title: 'Post-event follow-up', category: 'Operations', priority: 'MEDIUM' },
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
      group: t.group,
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
      message: `Project limit reached (${check.current}/${check.limit}). Adjust your configured limits to create more projects.`,
    })
  }

  const projectTitle = title || template.name

  // Create the project
  const project = await prisma.item.create({
    data: {
      workspaceId,
      title: projectTitle,
      description: template.description,
      itemType: 'WORKSTREAM',
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
