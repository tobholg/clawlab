import { hashPassword, verifyPassword } from './password'

type BcryptLike = {
  hash: (value: string, saltOrRounds?: number) => Promise<string>
  compare: (value: string, hash: string) => Promise<boolean>
}

let bcryptLoader: Promise<BcryptLike | null> | null = null

async function loadBcrypt(): Promise<BcryptLike | null> {
  if (!bcryptLoader) {
    bcryptLoader = (async () => {
      try {
        const mod = (await import('bcryptjs')) as any
        const bcrypt = mod?.default ?? mod

        if (typeof bcrypt?.hash === 'function' && typeof bcrypt?.compare === 'function') {
          return bcrypt as BcryptLike
        }
      } catch {
        // Fall back to the built-in scrypt utility when bcryptjs is unavailable.
      }

      return null
    })()
  }

  return bcryptLoader
}

export async function hashAgentApiKey(apiKey: string): Promise<string> {
  const bcrypt = await loadBcrypt()
  if (bcrypt) {
    return bcrypt.hash(apiKey, 10)
  }
  return hashPassword(apiKey)
}

export async function compareAgentApiKey(apiKey: string, hash: string): Promise<boolean> {
  const bcrypt = await loadBcrypt()
  if (bcrypt) {
    return bcrypt.compare(apiKey, hash)
  }
  return verifyPassword(apiKey, hash)
}
