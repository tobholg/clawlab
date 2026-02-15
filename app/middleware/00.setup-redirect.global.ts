export default defineNuxtRouteMiddleware(async (to) => {
  // Public pages that should always be accessible
  const publicPaths = ['/setup', '/', '/open-source', '/login', '/auth/confirm', '/onboarding']
  if (publicPaths.includes(to.path) || to.path.startsWith('/invite/') || to.path.startsWith('/s/')) {
    return
  }

  const { checkSetupStatus } = useSetupStatus()
  const needsSetup = await checkSetupStatus()

  // Only redirect on a definitive true (null = API error, don't redirect)
  if (needsSetup === true) {
    return navigateTo('/setup')
  }
})
