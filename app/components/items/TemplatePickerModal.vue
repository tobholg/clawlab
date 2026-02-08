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
    case 'Product': return 'bg-violet-100 text-violet-700'
    case 'Engineering': return 'bg-blue-100 text-blue-700'
    case 'Marketing': return 'bg-pink-100 text-pink-700'
    case 'Design': return 'bg-amber-100 text-amber-700'
    case 'Operations': return 'bg-emerald-100 text-emerald-700'
    case 'Research': return 'bg-cyan-100 text-cyan-700'
    default: return 'bg-slate-100 text-slate-700'
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
        <div class="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-medium text-slate-900">
                {{ selectedTemplate ? 'Create from template' : 'Choose a template' }}
              </h2>
              <p class="text-sm text-slate-500 mt-0.5">
                {{ selectedTemplate ? 'Customize your project name and create' : 'Start with a pre-built project structure' }}
              </p>
            </div>
            <button @click="emit('close')" class="p-1 text-slate-400 hover:text-slate-600 transition-colors">
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
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              ]"
            >
              General
            </button>
            <button
              @click="activeTab = 'specific'"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'specific'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              ]"
            >
              Specific
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Loading -->
            <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
              Loading templates...
            </div>

            <!-- Template detail / confirm -->
            <div v-else-if="selectedTemplate" class="space-y-4">
              <button
                @click="selectedTemplate = null"
                class="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Icon name="heroicons:arrow-left" class="w-3.5 h-3.5" />
                Back to templates
              </button>

              <div class="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon :name="selectedTemplate.icon" class="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 class="text-sm font-medium text-slate-900">{{ selectedTemplate.name }}</h3>
                  <p class="text-xs text-slate-500 mt-0.5">{{ selectedTemplate.description }}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-full', getCategoryColor(selectedTemplate.category)]">
                      {{ selectedTemplate.category }}
                    </span>
                    <span class="text-[10px] text-slate-400">{{ selectedTemplate.taskCount }} tasks</span>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Project name</label>
                <input
                  v-model="customTitle"
                  type="text"
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
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
                class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
              >
                <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon :name="template.icon" class="w-4.5 h-4.5 text-slate-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium text-slate-900">{{ template.name }}</h3>
                  <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ template.description }}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-full', getCategoryColor(template.category)]">
                      {{ template.category }}
                    </span>
                    <span class="text-[10px] text-slate-400">{{ template.taskCount }} tasks</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Footer (when template selected) -->
          <div v-if="selectedTemplate" class="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="createFromTemplate"
              :disabled="creating"
              class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
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
