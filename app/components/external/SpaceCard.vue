<script setup lang="ts">
interface Space {
  id: string
  name: string
  slug: string
  description?: string | null
  maxIRsPer24h: number
  allowTaskSubmission: boolean
  stakeholderCount: number
  createdAt: string
  updatedAt: string
}

defineProps<{
  space: Space
}>()

const emit = defineEmits<{
  settings: [space: Space]
  stakeholders: [space: Space]
  invite: [space: Space]
}>()
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
    <!-- Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center">
          <Icon name="heroicons:globe-alt" class="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h3 class="font-medium text-slate-900 text-sm">{{ space.name }}</h3>
          <p class="text-xs text-slate-400">/{{ space.slug }}</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="emit('invite', space)"
          class="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
          title="Copy invite link"
        >
          <Icon name="heroicons:link" class="w-4 h-4" />
        </button>
        <button
          @click="emit('settings', space)"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Space settings"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Description -->
    <p v-if="space.description" class="text-xs text-slate-500 mb-3 line-clamp-2">
      {{ space.description }}
    </p>

    <!-- Stats -->
    <div class="flex items-center gap-4 text-xs">
      <button 
        @click="emit('stakeholders', space)"
        class="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <Icon name="heroicons:users" class="w-3.5 h-3.5" />
        <span>{{ space.stakeholderCount }} {{ space.stakeholderCount === 1 ? 'member' : 'members' }}</span>
      </button>
      
      <div class="flex items-center gap-1.5 text-slate-400">
        <Icon name="heroicons:envelope" class="w-3.5 h-3.5" />
        <span>{{ space.maxIRsPer24h }}/day</span>
      </div>

      <div v-if="space.allowTaskSubmission" class="flex items-center gap-1.5 text-emerald-500">
        <Icon name="heroicons:check-circle" class="w-3.5 h-3.5" />
        <span>Tasks enabled</span>
      </div>
    </div>
  </div>
</template>
