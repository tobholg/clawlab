import { randomBytes } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { lookup as lookupMimeType } from 'mime-types'

const DEFAULT_UPLOAD_DIR = './data/uploads'
const DEFAULT_UPLOAD_MAX_SIZE = 268435456 // 256MB

const parsedMaxSize = Number(process.env.UPLOAD_MAX_SIZE)

export const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR)
export const UPLOAD_MAX_SIZE = Number.isFinite(parsedMaxSize) && parsedMaxSize > 0
  ? Math.floor(parsedMaxSize)
  : DEFAULT_UPLOAD_MAX_SIZE

type AttachmentMetadata = Record<string, unknown> | null

let sharpLoader: Promise<any | null> | null = null

function createStorageId() {
  return `c${Date.now().toString(36)}${randomBytes(8).toString('hex')}`
}

function normalizeExtension(originalName: string) {
  const extension = extname(originalName || '').toLowerCase()
  if (!extension) return ''
  if (!/^\.[a-z0-9]{1,16}$/.test(extension)) return ''
  return extension
}

function detectMimeType(originalName: string) {
  const detected = lookupMimeType(originalName)
  return typeof detected === 'string' ? detected : 'application/octet-stream'
}

async function getSharp() {
  if (!sharpLoader) {
    sharpLoader = import('sharp')
      .then((mod) => mod.default ?? mod)
      .catch(() => null)
  }

  return sharpLoader
}

function ensureSafeStoragePath(storagePath: string) {
  const targetPath = resolve(UPLOAD_DIR, storagePath)
  const rootPrefix = `${UPLOAD_DIR}/`
  if (targetPath !== UPLOAD_DIR && !targetPath.startsWith(rootPrefix)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid storage path' })
  }
  return targetPath
}

export async function saveFile(file: Buffer, originalName: string) {
  const monthBucket = new Date().toISOString().slice(0, 7)
  const extension = normalizeExtension(originalName)
  const storageId = createStorageId()
  const storagePath = `${monthBucket}/${storageId}${extension}`
  const absolutePath = getFilePath(storagePath)
  const mimeType = detectMimeType(originalName)
  const sizeBytes = file.byteLength

  let metadata: AttachmentMetadata = null

  if (mimeType.startsWith('image/')) {
    const sharp = await getSharp()
    if (sharp) {
      try {
        const imageMeta = await sharp(file).metadata()
        if (typeof imageMeta.width === 'number' && typeof imageMeta.height === 'number') {
          metadata = { width: imageMeta.width, height: imageMeta.height }
        }
      } catch {
        metadata = null
      }
    }
  }

  await mkdir(join(UPLOAD_DIR, monthBucket), { recursive: true })
  await writeFile(absolutePath, file)

  return {
    storagePath,
    mimeType,
    sizeBytes,
    metadata,
  }
}

export async function deleteFile(storagePath: string) {
  const absolutePath = getFilePath(storagePath)
  try {
    await rm(absolutePath, { force: true })
  } catch {
    // Ignore storage cleanup errors during deletion attempts.
  }
}

export function getFilePath(storagePath: string) {
  return ensureSafeStoragePath(storagePath)
}
