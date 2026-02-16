# Agent Activity Toast Redesign

## Problem
The current `AgentActivityToast.vue` has a completely different visual language from the rest of the app. It uses flashy gradients, colored provider surfaces, and overly complex styling that clashes with the clean, minimal Linear-inspired design system. It also lacks proper dark mode support matching the app's dark palette.

## Design System Reference
The app uses these dark mode patterns consistently:
- **Background:** `dark:bg-dm-surface` (#050506), `dark:bg-dm-card` (#111113), `dark:bg-[#020203]`
- **Borders:** `dark:border-white/[0.06]`, `dark:border-white/[0.075]`
- **Text:** `dark:text-zinc-100` (primary), `dark:text-zinc-400` (secondary), `dark:text-zinc-500` (tertiary)
- **Interactive surfaces:** `dark:bg-white/[0.06]` hover: `dark:bg-white/[0.08]`
- **Cards:** `bg-white dark:bg-dm-card border-slate-100 dark:border-white/[0.06]`
- **Font:** Inter (sans), semibold for labels, medium for body

## Redesign Requirements

### 1. Match `NotificationToast.vue` structure
Use the existing `NotificationToast.vue` as the base pattern. The agent toast should feel like a sibling, not a different component library. Same border radius (`rounded-xl`), same shadow approach, same padding, same transition classes.

### 2. Proper dark mode
Replace ALL custom color values with the app's design tokens:
- Card: `bg-white dark:bg-dm-card`
- Border: `border-slate-200 dark:border-white/[0.06]`
- Shadow: `shadow-lg` light, `dark:shadow-black/50` dark
- Text colors: use slate (light) / zinc (dark) scale consistently

### 3. Simplify provider indication
Remove the gradient surfaces, radial gradients, and per-provider surface colors. Instead:
- Keep the avatar with a subtle provider accent color (just the avatar circle, not the whole card)
- Use a tiny dot or subtle text label for provider, not a colored pill badge
- The card itself should be neutral (white/dm-card), not tinted per provider

### 4. Remove over-engineering
- Remove `--agent-surface-light`, `--agent-surface-dark`, `--agent-avatar-from`, `--agent-avatar-to` CSS variables
- Remove `.agent-surface` radial gradient overlay
- Remove the colored left border (`border-l-[3px]`)
- Remove the provider palette pill badge row ("OpenClaw agent activity")
- Keep it to: avatar, agent name, task path, activity description, timestamp, dismiss button

### 5. Clean layout
```
[Avatar] Agent Name                    2s [x]
         Project > Task Name
         Status changed: Scoping > Active
```

That's it. No badges, no pills, no gradients. Clean and informative.

### 6. Also fix NotificationToast dark mode
While you're at it, add proper dark mode to `NotificationToast.vue` using the same patterns. It currently has no dark mode classes at all.

## Files to modify
1. `app/components/ui/AgentActivityToast.vue` - Complete redesign
2. `app/components/ui/NotificationToast.vue` - Add dark mode support

## What NOT to change
- Keep the WebSocket composable (`useWebSocket.ts`) untouched
- Keep all the same props/events interface (dismissAgentActivity, pauseAgentActivityDismiss, resumeAgentActivityDismiss)
- Keep the same transition animations
- Keep the Teleport to body pattern
- Keep the activity label building logic (buildActivityLabel, buildPathLabel, formatRelativeTime)
- Keep the navigateToTask click handler
- Keep the PROVIDER_PALETTE object (still used for avatar color), but remove surfaceLight/surfaceDark from it
