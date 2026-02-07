export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = useAuth()

  // Ensure auth state is loaded before evaluating guest-only routes.
  await fetchUser()

  if (user.value) {
    return navigateTo('/workspace')
  }
})
