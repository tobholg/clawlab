import { prisma } from './prisma'

const DAY_MS = 24 * 60 * 60 * 1000
const UNLIMITED = Number.POSITIVE_INFINITY

function parsePositiveInt(value: string | undefined) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

export const UPLOAD_MAX_BYTES_PER_USER_PER_24H =
  parsePositiveInt(process.env.CLAWLAB_LIMIT_UPLOAD_BYTES_PER_USER_PER_24H) ?? UNLIMITED

export async function checkCanUploadFile(uploadedById: string, fileSizeBytes: number) {
  if (!Number.isFinite(UPLOAD_MAX_BYTES_PER_USER_PER_24H)) {
    return {
      allowed: true,
      current: 0,
      next: fileSizeBytes,
      limit: UNLIMITED,
    }
  }

  const since = new Date(Date.now() - DAY_MS)
  const aggregate = await prisma.attachment.aggregate({
    where: {
      uploadedById,
      createdAt: { gte: since },
    },
    _sum: { sizeBytes: true },
  })

  const current = aggregate._sum.sizeBytes ?? 0
  const next = current + fileSizeBytes
  const limit = UPLOAD_MAX_BYTES_PER_USER_PER_24H

  return {
    allowed: next <= limit,
    current,
    next,
    limit,
  }
}
