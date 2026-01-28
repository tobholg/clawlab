export default defineNuxtPlugin(async () => {
  const { fetchUser } = useAuth()
  
  // Fetch current user on app initialization
  await fetchUser()
})
