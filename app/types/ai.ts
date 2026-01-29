export interface ProposedTask {
  title: string
  description?: string | null
  children?: ProposedTask[]
}

export interface TaskProposal {
  id: string
  parentTitle: string
  projectId: string | null
  projectTitle?: string | null
  tasks: ProposedTask[]
}
