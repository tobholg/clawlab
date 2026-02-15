export default defineNuxtRouteMiddleware(async () => {
  const { checkSetupStatus } = useSetupStatus()
  const needsSetup = await checkSetupStatus()

  // Only redirect away on a definitive false (null = API error, allow through)
  if (needsSetup === false) {
    const { user, fetchUser } = useAuth()
    await fetchUser()
    return navigateTo(user.value ? '/workspace' : '/login')
  }
})
