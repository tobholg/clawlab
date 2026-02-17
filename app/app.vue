<script setup lang="ts">
import AppLightbox from '~/components/ui/AppLightbox.vue'
</script>

<template>
  <NuxtLayout class="antialiased">
    <NuxtPage />
  </NuxtLayout>

  <!-- Global notification toasts -->
  <UiNotificationToast />
  <AppLightbox />
</template>
