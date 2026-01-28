<script setup lang="ts">
import type { Scope } from '~/types'

defineProps<{
  scope: Scope
}>()

const scopeLabels: Record<Scope, string> = {
  XS: 'XS',
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
}
</script>

<template>
  <span 
    class="scope-badge"
    :class="`scope-badge--${scope.toLowerCase()}`"
  >
    {{ scopeLabels[scope] }}
  </span>
</template>
