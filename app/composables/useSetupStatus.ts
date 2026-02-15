export const useSetupStatus = () => {
  const needsSetup = useState<boolean | null>('setup-status', () => null)

  const checkSetupStatus = async () => {
    if (needsSetup.value !== null) return needsSetup.value

    try {
      const data = await $fetch('/api/setup/status')
      needsSetup.value = data.needsSetup
    } catch {
      // Don't cache errors — return null so callers can decide
      return null
    }

    return needsSetup.value
  }

  const clearSetupStatus = () => {
    needsSetup.value = null
  }

  return {
    needsSetup: readonly(needsSetup),
    checkSetupStatus,
    clearSetupStatus,
  }
}
