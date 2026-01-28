export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check for public routes
  const publicRoutes = ['/login', '/auth/confirm']
  if (publicRoutes.includes(to.path)) {
    return
  }

  const { user, fetchUser, loading } = useAuth()

  // Fetch user if not loaded
  if (!user.value && loading.value) {
    await fetchUser()
  }

  // Redirect to login if not authenticated
  if (!user.value) {
    return navigateTo('/login')
  }
})
