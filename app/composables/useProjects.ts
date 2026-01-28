export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: Date
  updatedAt: Date
  _count?: {
    tasks: number
  }
}

export const useProjects = () => {
  const projects = useState<Project[]>('projects', () => [])
  const currentProject = useState<Project | null>('current-project', () => null)
  const loading = useState('projects-loading', () => false)

  const fetchProjects = async () => {
    loading.value = true
    try {
      const response = await $fetch('/api/projects')
      projects.value = response.projects
      // Set first project as current if none selected
      if (!currentProject.value && projects.value.length > 0) {
        currentProject.value = projects.value[0]
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e)
    } finally {
      loading.value = false
    }
  }

  const createProject = async (data: { name: string; description?: string }) => {
    const response = await $fetch('/api/projects', {
      method: 'POST',
      body: data
    })
    projects.value = [response.project, ...projects.value]
    currentProject.value = response.project
    return response.project
  }

  const selectProject = (project: Project) => {
    currentProject.value = project
  }

  return {
    projects: readonly(projects),
    currentProject: readonly(currentProject),
    loading: readonly(loading),
    fetchProjects,
    createProject,
    selectProject
  }
}
