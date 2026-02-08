import type { SessionUser } from '~/server/utils/auth'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth-user', () => null)
  const loading = useState('auth-loading', () => true)

  const fetchUser = async () => {
    loading.value = true
    try {
      const { data } = await useFetch('/api/auth/session')
      user.value = data.value?.user || null
    } catch (error) {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  const requestMagicLink = async (email: string, options?: {
    inviteToken?: string
    displayName?: string
    position?: string
  }) => {
    const response = await $fetch('/api/auth/request-magic-link', {
      method: 'POST',
      body: {
        email,
        ...options
      }
    })
    return response
  }

  const confirmMagicLink = async (token: string, code: string) => {
    const response = await $fetch('/api/auth/confirm', {
      method: 'POST',
      body: { token, code }
    })
    if (response.user) {
      user.value = response.user
    }
    return response
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  return {
    user: readonly(user),
    loading: readonly(loading),
    isAuthenticated: computed(() => !!user.value),
    fetchUser,
    requestMagicLink,
    confirmMagicLink,
    logout
  }
}
