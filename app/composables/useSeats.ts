export function useSeats() {
  const { workspaceId } = useItems()

  const seats = useState<any[]>('seats-data', () => [])
  const seatSummary = useState<any>('seats-summary', () => null)
  const pendingInvites = useState<any[]>('seats-pending-invites', () => [])
  const loading = useState('seats-loading', () => false)
  const invitesLoading = useState('seats-invites-loading', () => false)

  const fetchSeats = async () => {
    if (!workspaceId.value) return
    loading.value = true
    try {
      const data = await $fetch('/api/seats', {
        query: { workspaceId: workspaceId.value },
      })
      seats.value = data.seats
      seatSummary.value = data.summary
    } catch (e) {
      console.error('Failed to fetch seats:', e)
    } finally {
      loading.value = false
    }
  }

  const fetchPendingInvites = async () => {
    if (!workspaceId.value) return
    invitesLoading.value = true
    try {
      pendingInvites.value = await $fetch('/api/seats/invites', {
        query: { workspaceId: workspaceId.value },
      })
    } catch (e) {
      console.error('Failed to fetch invites:', e)
    } finally {
      invitesLoading.value = false
    }
  }

  const purchaseSeats = async (count: number, type: 'INTERNAL' | 'EXTERNAL') => {
    if (!workspaceId.value) return
    await $fetch('/api/seats/purchase', {
      method: 'POST',
      body: { workspaceId: workspaceId.value, count, type },
    })
    await fetchSeats()
  }

  const sendInvite = async (email: string, role: string) => {
    if (!workspaceId.value) return
    const result = await $fetch('/api/seats/invite', {
      method: 'POST',
      body: { workspaceId: workspaceId.value, email, role },
    })
    await Promise.all([fetchSeats(), fetchPendingInvites()])
    return result
  }

  const cancelInvite = async (inviteId: string) => {
    if (!workspaceId.value) return
    await $fetch(`/api/seats/invites/${inviteId}`, {
      method: 'DELETE',
      query: { workspaceId: workspaceId.value },
    })
    await Promise.all([fetchSeats(), fetchPendingInvites()])
  }

  const freeSeat = async (seatId: string) => {
    if (!workspaceId.value) return
    await $fetch(`/api/seats/${seatId}`, {
      method: 'PATCH',
      body: { action: 'free_up', workspaceId: workspaceId.value },
    })
    await fetchSeats()
  }

  const removeSeat = async (seatId: string) => {
    if (!workspaceId.value) return
    await $fetch(`/api/seats/${seatId}`, {
      method: 'PATCH',
      body: { action: 'remove', workspaceId: workspaceId.value },
    })
    await fetchSeats()
  }

  const availableInternalSeats = computed(() => seatSummary.value?.internal?.available ?? 0)
  const availableExternalSeats = computed(() => seatSummary.value?.external?.available ?? 0)

  return {
    seats: readonly(seats),
    seatSummary: readonly(seatSummary),
    pendingInvites: readonly(pendingInvites),
    loading: readonly(loading),
    invitesLoading: readonly(invitesLoading),
    availableInternalSeats,
    availableExternalSeats,
    fetchSeats,
    fetchPendingInvites,
    purchaseSeats,
    sendInvite,
    cancelInvite,
    freeSeat,
    removeSeat,
  }
}
