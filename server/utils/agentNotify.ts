import { prisma } from './prisma'
import { broadcast } from './websocket'

export interface AgentActivityEvent {
  type: 'agent_activity'
  workspaceId: string
  agent: { id: string; name: string; provider: string | null }
  project: { id: string; title: string } | null
  task: { id: string; title: string }
  action: string
  detail: {
    field?: string
    oldValue?: string | null
    newValue?: string | null
    title?: string
  }
  timestamp: string
}

interface AgentUser {
  id: string
  name: string | null
  agentProvider: string | null
}

interface TaskContext {
  id: string
  title: string
  workspaceId: string
  projectId: string | null
}

// Cache project titles to avoid repeated lookups within the same request
const projectTitleCache = new Map<string, string>()

async function getProjectTitle(projectId: string): Promise<string> {
  const cached = projectTitleCache.get(projectId)
  if (cached) return cached

  const project = await prisma.item.findUnique({
    where: { id: projectId },
    select: { title: true },
  })

  const title = project?.title ?? 'Unknown Project'
  projectTitleCache.set(projectId, title)

  // Evict cache after 60s to avoid stale data
  setTimeout(() => projectTitleCache.delete(projectId), 60_000)

  return title
}

export async function emitAgentActivity(
  agent: AgentUser,
  task: TaskContext,
  action: string,
  detail: AgentActivityEvent['detail'] = {},
) {
  let project: AgentActivityEvent['project'] = null

  if (task.projectId) {
    const title = await getProjectTitle(task.projectId)
    project = { id: task.projectId, title }
  }

  const event: AgentActivityEvent = {
    type: 'agent_activity',
    workspaceId: task.workspaceId,
    agent: {
      id: agent.id,
      name: agent.name ?? 'Agent',
      provider: agent.agentProvider,
    },
    project,
    task: { id: task.id, title: task.title },
    action,
    detail,
    timestamp: new Date().toISOString(),
  }

  broadcast(event as any)
}

// Convenience helpers for common actions

export async function emitStatusChange(agent: AgentUser, task: TaskContext, oldStatus: string, newStatus: string) {
  await emitAgentActivity(agent, task, 'status_change', {
    field: 'Status',
    oldValue: formatStatus(oldStatus),
    newValue: formatStatus(newStatus),
  })
}

export async function emitProgressUpdate(agent: AgentUser, task: TaskContext, oldProgress: number, newProgress: number) {
  await emitAgentActivity(agent, task, 'progress_update', {
    field: 'Progress',
    oldValue: `${oldProgress}%`,
    newValue: `${newProgress}%`,
  })
}

export async function emitSubStatusChange(agent: AgentUser, task: TaskContext, oldSubStatus: string | null, newSubStatus: string | null) {
  await emitAgentActivity(agent, task, 'substatus_change', {
    field: 'Stage',
    oldValue: formatSubStatus(oldSubStatus),
    newValue: formatSubStatus(newSubStatus),
  })
}

export async function emitFieldUpdate(agent: AgentUser, task: TaskContext, field: string, oldValue: string | null, newValue: string | null) {
  await emitAgentActivity(agent, task, 'field_updated', {
    field,
    oldValue,
    newValue,
  })
}

export async function emitSubtaskCreated(agent: AgentUser, task: TaskContext, subtaskTitle: string) {
  await emitAgentActivity(agent, task, 'subtask_created', { title: subtaskTitle })
}

export async function emitSubtaskDeleted(agent: AgentUser, task: TaskContext, subtaskTitle: string) {
  await emitAgentActivity(agent, task, 'subtask_deleted', { title: subtaskTitle })
}

export async function emitCommentAdded(agent: AgentUser, task: TaskContext, commentPreview: string) {
  await emitAgentActivity(agent, task, 'comment_added', {
    title: commentPreview.length > 100 ? commentPreview.slice(0, 100) + '…' : commentPreview,
  })
}

export async function emitDocCreated(agent: AgentUser, task: TaskContext, docTitle: string) {
  await emitAgentActivity(agent, task, 'doc_created', { title: docTitle })
}

export async function emitDocUpdated(agent: AgentUser, task: TaskContext, docTitle: string, versionNumber?: number) {
  await emitAgentActivity(agent, task, 'doc_updated', {
    title: docTitle,
    newValue: versionNumber ? `v${versionNumber}` : undefined,
  })
}

// Format helpers

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatSubStatus(subStatus: string | null): string {
  if (!subStatus) return 'None'
  return subStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
