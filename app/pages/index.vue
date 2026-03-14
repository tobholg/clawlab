<script setup lang="ts">
definePageMeta({ layout: false })

const { checkSetupStatus } = useSetupStatus()
const { user, fetchUser } = useAuth()

const needsSetup = await checkSetupStatus()

if (needsSetup) {
  await navigateTo('/setup', { replace: true })
} else {
  await fetchUser()
  await navigateTo(user.value ? '/workspace' : '/login', { replace: true })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-dm-surface">
    <div class="text-slate-400 dark:text-zinc-500 text-sm">Redirecting...</div>
  </div>
</template>
