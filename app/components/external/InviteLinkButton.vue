<script setup lang="ts">
const props = defineProps<{
  projectId: string
  spaceId: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
}>()

const loading = ref(false)
const copied = ref(false)
const inviteUrl = ref<string | null>(null)

const generateAndCopy = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ inviteUrl: string }>(
      `/api/projects/${props.projectId}/spaces/${props.spaceId}/invite`,
      { method: 'POST' }
    )
    inviteUrl.value = response.inviteUrl
    
    await navigator.clipboard.writeText(response.inviteUrl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (e: any) {
    alert('Failed to generate invite: ' + (e.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

const variant = computed(() => props.variant || 'primary')
const size = computed(() => props.size || 'md')

const buttonClasses = computed(() => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-50'
  
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
  }
  
  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  }
  
  return `${base} ${variants[variant.value]} ${sizes[size.value]}`
})

const iconSize = computed(() => size.value === 'sm' ? 'w-3 h-3' : 'w-4 h-4')
</script>

<template>
  <button
    @click="generateAndCopy"
    :disabled="loading"
    :class="buttonClasses"
  >
    <Icon 
      v-if="loading"
      name="heroicons:arrow-path" 
      :class="[iconSize, 'animate-spin']" 
    />
    <Icon 
      v-else-if="copied"
      name="heroicons:check" 
      :class="iconSize" 
    />
    <Icon 
      v-else
      name="heroicons:link" 
      :class="iconSize" 
    />
    <span>{{ copied ? 'Copied!' : 'Invite Link' }}</span>
  </button>
</template>
