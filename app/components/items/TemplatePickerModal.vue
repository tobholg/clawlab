<script setup lang="ts">
const props = defineProps<{
  open: boolean
  workspaceId?: string | null
}>()

const emit = defineEmits<{
  close: []
  created: [project: { id: string; title: string }]
}>()

const templates = ref<any[]>([])
const loading = ref(false)
const creating = ref(false)
const selectedTemplate = ref<any>(null)
const customTitle = ref('')
const activeTab = ref<'general' | 'specific'>('general')

const generalTemplates = computed(() => templates.value.filter(t => t.group === 'general'))
const specificTemplates = computed(() => templates.value.filter(t => t.group === 'specific'))
const displayedTemplates = computed(() => activeTab.value === 'general' ? generalTemplates.value : specificTemplates.value)

const fetchTemplates = async () => {
  loading.value = true
  try {
    templates.value = await $fetch('/api/items/from-template', {
      method: 'POST',
      body: { listTemplates: true }
    })
  } catch (e) {
    console.error('Failed to fetch templates:', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen && !templates.value.length) {
    fetchTemplates()
  }
  if (isOpen) {
    selectedTemplate.value = null
    customTitle.value = ''
    activeTab.value = 'general'
  }
})

const selectTemplate = (template: any) => {
  selectedTemplate.value = template
  customTitle.value = template.name
}

const createFromTemplate = async () => {
  if (!selectedTemplate.value || !props.workspaceId || creating.value) return

  creating.value = true
  try {
    const result = await $fetch('/api/items/from-template', {
      method: 'POST',
      body: {
        templateId: selectedTemplate.value.id,
        workspaceId: props.workspaceId,
        title: customTitle.value || selectedTemplate.value.name,
      }
    })
    emit('created', result)
  } catch (e: any) {
    if (e?.statusCode === 403 || e?.data?.statusCode === 403) {
      emit('created', { error: true, message: e?.data?.message || e?.message || 'Plan limit reached.' } as any)
    } else {
      console.error('Failed to create from template:', e)
    }
  } finally {
    creating.value = false
  }
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Product': return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400'
    case 'Engineering': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
    case 'Marketing': return 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400'
    case 'Design': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
    case 'Operations': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
    case 'Research': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400'
    default: return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-400'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="slide-up">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div class="bg-white dark:bg-dm-surface rounded-xl shadow-2xl dark:shadow-black/40 border border-slate-200 dark:border-white/[0.06] w-full max-w-2xl max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 class="text-lg font-medium text-slate-900 dark:text-zinc-100">
                {{ selectedTemplate ? 'Create from template' : 'Choose a template' }}
              </h2>
              <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                {{ selectedTemplate ? 'Customize your project name and create' : 'Start with a pre-built project structure' }}
              </p>
            </div>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Tabs (only when browsing, not when a template is selected) -->
          <div v-if="!selectedTemplate && !loading" class="px-6 pt-4 flex gap-1">
            <button
              @click="activeTab = 'general'"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'general'
                  ? 'bg-slate-900 text-white dark:bg-white/[0.1] dark:text-zinc-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06]'
              ]"
            >
              General
            </button>
            <button
              @click="activeTab = 'specific'"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'specific'
                  ? 'bg-slate-900 text-white dark:bg-white/[0.1] dark:text-zinc-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06]'
              ]"
            >
              Specific
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Loading -->
            <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8 justify-center">
              <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
              Loading templates...
            </div>

            <!-- Template detail / confirm -->
            <div v-else-if="selectedTemplate" class="space-y-4">
              <button
                @click="selectedTemplate = null"
                class="flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
              >
                <Icon name="heroicons:arrow-left" class="w-3.5 h-3.5" />
                Back to templates
              </button>

              <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-slate-100 dark:border-white/[0.06]">
                <div class="w-10 h-10 rounded-lg bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Icon :name="selectedTemplate.icon" class="w-5 h-5 text-slate-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100">{{ selectedTemplate.name }}</h3>
                  <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{{ selectedTemplate.description }}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-full', getCategoryColor(selectedTemplate.category)]">
                      {{ selectedTemplate.category }}
                    </span>
                    <span class="text-[10px] text-slate-400 dark:text-zinc-500">{{ selectedTemplate.taskCount }} tasks</span>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Project name</label>
                <input
                  v-model="customTitle"
                  type="text"
                  class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 focus:border-slate-300 dark:focus:border-white/[0.1] dark:bg-white/[0.06] dark:text-zinc-100 dark:placeholder-zinc-500 transition-all"
                  placeholder="Project name..."
                  @keydown.enter="createFromTemplate"
                />
              </div>
            </div>

            <!-- Template grid -->
            <div v-else class="grid grid-cols-2 gap-3">
              <button
                v-for="template in displayedTemplates"
                :key="template.id"
                @click="selectTemplate(template)"
                class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all text-left"
              >
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Icon :name="template.icon" class="w-4.5 h-4.5 text-slate-600 dark:text-zinc-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-200">{{ template.name }}</h3>
                  <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{{ template.description }}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-full', getCategoryColor(template.category)]">
                      {{ template.category }}
                    </span>
                    <span class="text-[10px] text-slate-400 dark:text-zinc-500">{{ template.taskCount }} tasks</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Footer (when template selected) -->
          <div v-if="selectedTemplate" class="px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="createFromTemplate"
              :disabled="creating"
              class="px-4 py-2 bg-slate-900 dark:bg-white/[0.1] text-white dark:text-zinc-200 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-white/[0.15] transition-colors disabled:opacity-50"
            >
              {{ creating ? 'Creating...' : 'Create project' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 200ms ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
