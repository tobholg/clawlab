export type OrgDetails = {
  id: string
  name: string
  slug: string
  billingEmail: string | null
  planTier: string
  trialEndsAt: string | null
  createdAt: string
  limits: Record<string, any>
  usage: Record<string, any>
  aiCredits: { current: number; limit: number }
  orgRole: 'OWNER' | 'ADMIN'
}

export type OrgMember = {
  id: string
  userId: string
  name: string | null
  email: string
  position: string | null
  avatar: string | null
  orgRole: string
  status: string
  joinedAt: string
  workspaces: { id: string; name: string; role: string }[]
}

export type OrgWorkspace = {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  itemCount: number
  memberCount: number
  projectCount: number
}

export function useOrganization() {
  const { currentWorkspace } = useWorkspaces()

  const organizationId = computed(() => currentWorkspace.value?.organizationId ?? null)

  const orgDetails = useState<OrgDetails | null>('org-details', () => null)
  const orgMembers = useState<OrgMember[]>('org-members', () => [])
  const orgWorkspaces = useState<OrgWorkspace[]>('org-workspaces', () => [])
  const loading = useState('org-loading', () => false)
  const membersLoading = useState('org-members-loading', () => false)
  const workspacesLoading = useState('org-workspaces-loading', () => false)

  const fetchOrgDetails = async () => {
    if (!organizationId.value) return
    loading.value = true
    try {
      orgDetails.value = await $fetch<OrgDetails>(`/api/organizations/${organizationId.value}`)
    } catch (e) {
      console.error('Failed to fetch org details:', e)
      orgDetails.value = null
    } finally {
      loading.value = false
    }
  }

  const updateOrg = async (data: { name?: string; billingEmail?: string | null }) => {
    if (!organizationId.value) return
    const updated = await $fetch(`/api/organizations/${organizationId.value}`, {
      method: 'PATCH',
      body: data,
    })
    if (orgDetails.value) {
      orgDetails.value = { ...orgDetails.value, ...updated }
    }
    return updated
  }

  const fetchOrgMembers = async (includeDeactivated = true) => {
    if (!organizationId.value) return
    membersLoading.value = true
    try {
      orgMembers.value = await $fetch<OrgMember[]>(`/api/organizations/${organizationId.value}/members`, {
        query: { includeDeactivated: includeDeactivated ? 'true' : 'false' },
      })
    } catch (e) {
      console.error('Failed to fetch org members:', e)
    } finally {
      membersLoading.value = false
    }
  }

  const fetchOrgWorkspaces = async () => {
    if (!organizationId.value) return
    workspacesLoading.value = true
    try {
      orgWorkspaces.value = await $fetch<OrgWorkspace[]>(`/api/organizations/${organizationId.value}/workspaces`)
    } catch (e) {
      console.error('Failed to fetch org workspaces:', e)
    } finally {
      workspacesLoading.value = false
    }
  }

  const changePlan = async (planTier: string, internalSeats?: number, externalSeats?: number) => {
    if (!organizationId.value) return
    const result = await $fetch(`/api/organizations/${organizationId.value}/plan`, {
      method: 'PATCH',
      body: { planTier, internalSeats, externalSeats },
    })
    await fetchOrgDetails()
    return result
  }

  const isOrgOwner = computed(() => orgDetails.value?.orgRole === 'OWNER')

  return {
    organizationId,
    orgDetails,
    orgMembers,
    orgWorkspaces,
    loading: readonly(loading),
    membersLoading: readonly(membersLoading),
    workspacesLoading: readonly(workspacesLoading),
    isOrgOwner,
    fetchOrgDetails,
    updateOrg,
    fetchOrgMembers,
    fetchOrgWorkspaces,
    changePlan,
  }
}
