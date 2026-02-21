<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  open: boolean
  item: ItemNode | null
}>()

const emit = defineEmits<{
  close: []
  update: [id: string, data: any]
  viewFull: [item: ItemNode]
  deleted: [id: string]
}>()

// Second-panel push state
const pushedItemId = ref<string | null>(null)
const pushPanel = (id: string) => { pushedItemId.value = id }
const popPanel = () => { pushedItemId.value = null }
const syncPushedPanelItem = (id: string) => { pushedItemId.value = id }

// Ref to panel 1 for programmatic close (ensures pending saves flush)
const panel1Ref = ref<{ handleClose: () => Promise<void> } | null>(null)

const handleClose = () => panel1Ref.value?.handleClose() ?? emit('close')

// Reset pushed panel when the primary item changes or modal closes
watch([() => props.item?.id, () => props.open], () => {
  pushedItemId.value = null
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open && item"
        class="fixed inset-0 z-50 flex justify-end overflow-hidden"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40"
          @click="handleClose"
        />

        <!-- Panel 1: main item -->
        <div
          class="panel relative w-full max-w-xl lg:max-w-2xl 2xl:max-w-3xl h-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          :class="pushedItemId ? '-translate-x-[320px] xl:-translate-x-[360px]' : ''"
        >
          <!-- Dark scrim + click-to-pop overlay when panel 2 is open -->
          <Transition name="scrim">
            <div
              v-if="pushedItemId"
              class="absolute inset-0 bg-slate-900/20 dark:bg-black/25 cursor-pointer z-20"
              @click="popPanel"
            />
          </Transition>
          <ItemsItemDetailPanel
            ref="panel1Ref"
            :item-id="item.id"
            :pushed="!!pushedItemId"
            @close="emit('close')"
            @update="(id, data) => emit('update', id, data)"
            @view-full="(i) => emit('viewFull', i)"
            @deleted="(id) => emit('deleted', id)"
            @push-subtask="pushPanel"
          />
        </div>

        <!-- Panel 2: pushed subtask detail (slides in from right) -->
        <Transition name="push-panel">
          <div
            v-if="pushedItemId"
            class="absolute inset-y-0 right-0 w-full max-w-xl lg:max-w-2xl 2xl:max-w-3xl z-30"
          >
            <ItemsItemDetailPanel
              :item-id="pushedItemId"
              :is-child-pane="true"
              @navigated="syncPushedPanelItem"
              @close="popPanel"
              @update="(id, data) => emit('update', id, data)"
              @view-full="(i) => emit('viewFull', i)"
              @deleted="(id) => { popPanel(); emit('deleted', id) }"
              @push-subtask="pushPanel"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Panel slide-in from right */
.modal-enter-active .panel,
.modal-leave-active .panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-enter-from .panel,
.modal-leave-to .panel {
  transform: translateX(100%);
}

/* Panel 1 scrim fade */
.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 0.3s ease;
}

.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}

/* Push panel slide-in from right */
.push-panel-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.push-panel-leave-active {
  transition: transform 0.25s ease-in;
}

.push-panel-enter-from,
.push-panel-leave-to {
  transform: translateX(100%);
}
</style>
