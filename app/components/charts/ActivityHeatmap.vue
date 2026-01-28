<script setup lang="ts">
import type { ActivityData } from '~/types'

const props = defineProps<{
  data: ActivityData[]
  weeks?: number
}>()

const weeks = props.weeks || 52
const days = ['Mon', '', 'Wed', '', 'Fri', '', '']

// Generate grid data (weeks x 7 days)
const grid = computed(() => {
  const result: ActivityData[][] = []
  const dataMap = new Map(props.data.map(d => [d.date, d]))

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - weeks * 7)

  // Align to Monday
  const dayOfWeek = startDate.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startDate.setDate(startDate.getDate() + diff)

  let currentWeek: ActivityData[] = []

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]

    const activity = dataMap.get(dateStr) || {
      date: dateStr,
      count: 0,
      level: 0 as const,
    }

    currentWeek.push(activity)

    if (currentWeek.length === 7) {
      result.push(currentWeek)
      currentWeek = []
    }
  }

  if (currentWeek.length > 0) {
    result.push(currentWeek)
  }

  return result
})

// Get month labels
const months = computed(() => {
  const result: { label: string; offset: number }[] = []
  let lastMonth = -1

  grid.value.forEach((week, weekIndex) => {
    const firstDay = new Date(week[0].date)
    const month = firstDay.getMonth()

    if (month !== lastMonth) {
      result.push({
        label: firstDay.toLocaleDateString('en', { month: 'short' }),
        offset: weekIndex,
      })
      lastMonth = month
    }
  })

  return result
})

const totalActivity = computed(() => 
  props.data.reduce((sum, d) => sum + d.count, 0)
)
</script>

<template>
  <div class="activity-heatmap">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-medium text-gray-700">Activity</h3>
      <span class="text-xs text-gray-500">
        {{ totalActivity }} contributions in the last year
      </span>
    </div>

    <!-- Month labels -->
    <div class="flex mb-1 ml-8">
      <div 
        v-for="month in months" 
        :key="month.label + month.offset"
        class="text-xs text-gray-400"
        :style="{ marginLeft: month.offset === 0 ? '0' : `${(month.offset - (months[months.indexOf(month) - 1]?.offset || 0)) * 14 - 14}px` }"
      >
        {{ month.label }}
      </div>
    </div>

    <!-- Grid -->
    <div class="flex gap-0.5">
      <!-- Day labels -->
      <div class="flex flex-col gap-0.5 mr-1">
        <div 
          v-for="(day, i) in days" 
          :key="i"
          class="h-3 text-xs text-gray-400 leading-3"
        >
          {{ day }}
        </div>
      </div>

      <!-- Weeks -->
      <div class="flex gap-0.5">
        <div 
          v-for="(week, weekIndex) in grid" 
          :key="weekIndex"
          class="flex flex-col gap-0.5"
        >
          <div
            v-for="(day, dayIndex) in week"
            :key="day.date"
            class="activity-cell"
            :class="`activity-cell--${day.level}`"
            :title="`${day.count} activities on ${day.date}`"
          />
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-end gap-1 mt-2">
      <span class="text-xs text-gray-400">Less</span>
      <div class="activity-cell activity-cell--0" />
      <div class="activity-cell activity-cell--1" />
      <div class="activity-cell activity-cell--2" />
      <div class="activity-cell activity-cell--3" />
      <div class="activity-cell activity-cell--4" />
      <span class="text-xs text-gray-400">More</span>
    </div>
  </div>
</template>
