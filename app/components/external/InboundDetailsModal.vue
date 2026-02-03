<script setup lang="ts">
interface Submitter {
  displayName: string
  position?: string
}

interface ExternalComment {
  id: string
  authorName: string
  content: string
  isTeamMember: boolean
  createdAt: string
}

interface InboundTask {
  id: string
  type: 'task'
  spaceId: string
  spaceName: string
  title: string
  description: string
  status: string
  submitter: Submitter
  submittedAt: string
  internalNotes?: string
  linkedTaskId?: string
  rejectionReason?: string
  comments: ExternalComment[]
}

interface InboundIR {
  id: string
  type: 'question' | 'suggestion'
  spaceId: string
  spaceName: string
  content: string
  status: string
  submitter: Submitter
  submittedAt: string
  voteCount: number
  response?: string
  respondedAt?: string
  respondedBy?: string
  addedToAIContext: boolean
  convertedToTaskId?: string
  comments: ExternalComment[]
}

type InboundItem = InboundTask | InboundIR

const props = defineProps<{
  open: boolean
  item: InboundItem | null
  projectId: string
}>()

const emit = defineEmits<{
  close: []
  action: []
}>()

const internalNotes = ref('')
const savingNotes = ref(false)
const notesTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Reply state
const replyContent = ref('')
const submittingReply = ref(false)

// Sync internal notes when item changes
watch(() => props.item, (item) => {
  if (item && item.type === 'task') {
    internalNotes.value = (item as InboundTask).internalNotes || ''
  } else {
    internalNotes.value = ''
  }
  replyContent.value = ''
})

// Submit reply comment
const submitReply = async () => {
  if (!props.item || !replyContent.value.trim()) return
  
  submittingReply.value = true
  try {
    const endpoint = props.item.type === 'task'
      ? `/api/projects/${props.projectId}/inbound/tasks/${props.item.id}/comment`
      : `/api/projects/${props.projectId}/inbound/ir/${props.item.id}/comment`
    
    const result = await $fetch<{ comment: ExternalComment }>(endpoint, {
      method: 'POST',
      body: { content: replyContent.value.trim() }
    })
    
    // Add comment to local state
    if (props.item.type === 'task') {
      (props.item as InboundTask).comments.push(result.comment)
    } else {
      (props.item as InboundIR).comments.push(result.comment)
    }
    
    replyContent.value = ''
    emit('action')
  } catch (e: any) {
    alert('Failed to send reply: ' + (e.data?.message || e.message))
  } finally {
    submittingReply.value = false
  }
}

// Debounced save for internal notes
const saveInternalNotes = async () => {
  if (!props.item || props.item.type !== 'task') return
  
  savingNotes.value = true
  try {
    await $fetch(`/api/projects/${props.projectId}/inbound/tasks/${props.item.id}`, {
      method: 'PATCH',
      body: { internalNotes: internalNotes.value }
    })
  } catch (e: any) {
    console.error('Failed to save notes:', e)
  } finally {
    savingNotes.value = false
  }
}

const debouncedSaveNotes = () => {
  if (notesTimeout.value) clearTimeout(notesTimeout.value)
  notesTimeout.value = setTimeout(saveInternalNotes, 500)
}

watch(internalNotes, (val, oldVal) => {
  // Only save if we actually changed something (not initial load)
  if (oldVal !== undefined && val !== oldVal) {
    debouncedSaveNotes()
  }
})

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

// Type colors
const typeBadgeClass = (type: string) => {
  switch (type) {
    case 'task': return 'bg-blue-100 text-blue-700'
    case 'question': return 'bg-amber-100 text-amber-700'
    case 'suggestion': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

// Status colors
const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700'
    case 'needs_info': return 'bg-orange-100 text-orange-700'
    case 'accepted': return 'bg-green-100 text-green-700'
    case 'answered': return 'bg-green-100 text-green-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'declined': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && item" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" @click="handleClose" />
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span :class="['px-2 py-0.5 text-[10px] font-medium rounded-full', typeBadgeClass(item.type)]">
                  {{ item.type.charAt(0).toUpperCase() + item.type.slice(1) }}
                </span>
                <span :class="['px-2 py-0.5 text-[10px] font-medium rounded-full', statusBadgeClass(item.status)]">
                  {{ item.status.replace('_', ' ') }}
                </span>
                <span class="text-xs text-slate-400">{{ item.spaceName }}</span>
              </div>
              <h2 class="text-base font-medium text-slate-900">
                {{ item.type === 'task' ? (item as InboundTask).title : 'Information Request' }}
              </h2>
            </div>
            <button
              @click="handleClose"
              class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Submitter info -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
                <span class="text-sm text-white font-medium">
                  {{ item.submitter.displayName.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div>
                <div class="text-sm font-medium text-slate-900">{{ item.submitter.displayName }}</div>
                <div class="text-xs text-slate-500">
                  <span v-if="item.submitter.position">{{ item.submitter.position }} · </span>
                  {{ formatDate(item.submittedAt) }}
                </div>
              </div>
            </div>
            
            <!-- Main content -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-2">
                {{ item.type === 'task' ? 'Description' : 'Content' }}
              </label>
              <div class="bg-slate-50 rounded-lg p-4">
                <p class="text-sm text-slate-700 whitespace-pre-wrap">
                  {{ item.type === 'task' ? (item as InboundTask).description : (item as InboundIR).content }}
                </p>
              </div>
            </div>
            
            <!-- Votes (for IRs) -->
            <div v-if="item.type !== 'task' && (item as InboundIR).voteCount > 0" class="flex items-center gap-2">
              <Icon name="heroicons:arrow-up" class="w-4 h-4 text-slate-500" />
              <span class="text-sm text-slate-600">{{ (item as InboundIR).voteCount }} votes</span>
            </div>
            
            <!-- Response (for IRs) -->
            <div v-if="item.type !== 'task' && (item as InboundIR).response">
              <label class="block text-xs font-medium text-slate-500 mb-2">
                Response
              </label>
              <div class="bg-green-50 border border-green-100 rounded-lg p-4">
                <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ (item as InboundIR).response }}</p>
                <p class="text-xs text-slate-500 mt-2">
                  Responded by {{ (item as InboundIR).respondedBy }} · {{ formatDate((item as InboundIR).respondedAt!) }}
                </p>
              </div>
            </div>
            
            <!-- Comments Thread (for both tasks and IRs) -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-2">
                Conversation
              </label>
              
              <!-- Comments list -->
              <div v-if="item.type === 'task' ? (item as InboundTask).comments.length > 0 : (item as InboundIR).comments.length > 0" class="space-y-2 mb-3">
                <div
                  v-for="comment in (item.type === 'task' ? (item as InboundTask).comments : (item as InboundIR).comments)"
                  :key="comment.id"
                  :class="[
                    'rounded-lg p-3',
                    comment.isTeamMember ? 'bg-violet-50 border border-violet-100 ml-4' : 'bg-slate-50 mr-4'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span :class="[
                      'text-xs font-medium',
                      comment.isTeamMember ? 'text-violet-700' : 'text-slate-700'
                    ]">
                      {{ comment.authorName }}
                    </span>
                    <span v-if="comment.isTeamMember" class="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded-full">
                      Team
                    </span>
                    <span class="text-[10px] text-slate-400">{{ formatDate(comment.createdAt) }}</span>
                  </div>
                  <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ comment.content }}</p>
                </div>
              </div>
              
              <div v-else class="text-xs text-slate-400 mb-3 py-4 text-center bg-slate-50 rounded-lg">
                No comments yet
              </div>
              
              <!-- Reply input -->
              <div class="flex gap-2">
                <textarea
                  v-model="replyContent"
                  rows="2"
                  placeholder="Type a reply to the stakeholder..."
                  class="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all resize-none"
                />
                <button
                  @click="submitReply"
                  :disabled="!replyContent.trim() || submittingReply"
                  class="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end"
                >
                  {{ submittingReply ? '...' : 'Send' }}
                </button>
              </div>
            </div>
            
            <!-- Internal notes (for tasks) -->
            <div v-if="item.type === 'task'">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-medium text-slate-500">
                  Internal Notes
                  <span class="text-slate-400 font-normal">(team only, not visible to stakeholder)</span>
                </label>
                <span v-if="savingNotes" class="text-xs text-slate-400">Saving...</span>
              </div>
              <textarea
                v-model="internalNotes"
                rows="3"
                placeholder="Add notes for your team..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
              />
            </div>
            
            <!-- Rejection reason -->
            <div v-if="item.status === 'rejected' && item.type === 'task' && (item as InboundTask).rejectionReason">
              <label class="block text-xs font-medium text-slate-500 mb-2">
                Rejection Reason
              </label>
              <div class="bg-red-50 border border-red-100 rounded-lg p-4">
                <p class="text-sm text-slate-700">{{ (item as InboundTask).rejectionReason }}</p>
              </div>
            </div>
            
            <!-- Linked task -->
            <div v-if="item.type === 'task' && (item as InboundTask).linkedTaskId" class="flex items-center gap-2 text-sm">
              <Icon name="heroicons:link" class="w-4 h-4 text-slate-400" />
              <span class="text-slate-600">Linked to task:</span>
              <NuxtLink
                :to="`/workspace/projects/${(item as InboundTask).linkedTaskId}`"
                class="text-blue-600 hover:underline"
              >
                View task
              </NuxtLink>
            </div>
            
            <!-- Converted to task (for suggestions) -->
            <div v-if="item.type === 'suggestion' && (item as InboundIR).convertedToTaskId" class="flex items-center gap-2 text-sm">
              <Icon name="heroicons:arrow-right-circle" class="w-4 h-4 text-emerald-500" />
              <span class="text-slate-600">Converted to task:</span>
              <NuxtLink
                :to="`/workspace/projects/${(item as InboundIR).convertedToTaskId}`"
                class="text-blue-600 hover:underline"
              >
                View task
              </NuxtLink>
            </div>
            
            <!-- AI Context badge -->
            <div v-if="item.type !== 'task' && (item as InboundIR).addedToAIContext" class="flex items-center gap-2 text-sm">
              <Icon name="heroicons:sparkles" class="w-4 h-4 text-purple-500" />
              <span class="text-purple-700">Added to AI context</span>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 flex justify-end">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.15s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
}
</style>
