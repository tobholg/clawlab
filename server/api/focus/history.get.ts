// GET /api/focus/history - Get focus session history for a user
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const query = getQuery(event)
  const userId = (query.userId as string) || sessionUser.id
  const days = parseInt(query.days as string) || 7 // Default to 7 days

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      startedAt: { gte: startDate },
    },
    include: {
      task: { select: { id: true, title: true, status: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  // Group sessions by date
  const grouped: Record<string, any[]> = {}

  for (const session of sessions) {
    const dateKey = session.startedAt.toISOString().split('T')[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }

    const durationMs = session.endedAt 
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : new Date().getTime() - session.startedAt.getTime()
    const durationMins = Math.round(durationMs / 60000)

    grouped[dateKey].push({
      id: session.id,
      activityType: session.activityType,
      lane: session.lane,
      task: session.task,
      project: session.project,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() || null,
      durationMins,
      endReason: session.endReason,
      comment: session.comment,
      commentedAt: session.commentedAt?.toISOString() || null,
      isActive: !session.endedAt,
    })
  }

  // Convert to array sorted by date desc
  const timeline = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sessions]) => ({
      date,
      sessions: sessions.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      ),
    }))

  return { timeline }
})
