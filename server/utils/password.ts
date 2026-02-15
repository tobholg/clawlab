import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const buf = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${buf.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const buf = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return timingSafeEqual(buf, Buffer.from(key, 'hex'))
}
