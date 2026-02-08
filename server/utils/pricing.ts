// Marginal tiered seat pricing (tax-bracket model)
// PRO plan only — FREE is free, ENTERPRISE is custom.

export type SeatType = 'INTERNAL' | 'EXTERNAL'

export interface Tier {
  brackets: readonly { min: number; max: number }[]
  prices: readonly number[]
}

export const SEAT_TIERS: Record<SeatType, Tier> = {
  INTERNAL: {
    brackets: [
      { min: 1, max: 3 },
      { min: 4, max: 25 },
      { min: 26, max: 50 },
      { min: 51, max: 100 },
    ],
    prices: [9, 7, 6, 5],
  },
  EXTERNAL: {
    brackets: [
      { min: 1, max: 3 },
      { min: 4, max: 25 },
      { min: 26, max: 50 },
      { min: 51, max: 100 },
    ],
    prices: [5, 3, 2.5, 2],
  },
}

export const MAX_PRO_SEATS = 100

/** Rate for the Nth seat (1-indexed). */
export function rateForSeat(n: number, type: SeatType): number {
  const { brackets, prices } = SEAT_TIERS[type]
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i]!
    if (n >= b.min && n <= b.max) {
      return prices[i]!
    }
  }
  return prices[prices.length - 1]!
}

export interface BracketLine {
  bracket: { min: number; max: number }
  count: number
  rate: number
  subtotal: number
}

/** Full cost for `count` seats of a given type. */
export function calculateSeatCost(count: number, type: SeatType): number {
  let total = 0
  for (let i = 1; i <= count; i++) {
    total += rateForSeat(i, type)
  }
  return total
}

/** Breakdown by bracket for `count` seats. */
export function getSeatBreakdown(count: number, type: SeatType): BracketLine[] {
  const lines: BracketLine[] = []
  const { brackets, prices } = SEAT_TIERS[type]
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!
    const rate = prices[i]!
    const lo = bracket.min
    const hi = Math.min(bracket.max, count)
    if (count < lo) break
    const seatsInBracket = hi - lo + 1
    lines.push({ bracket: { min: lo, max: bracket.max }, count: seatsInBracket, rate, subtotal: seatsInBracket * rate })
  }
  return lines
}

/** Cost of adding `addCount` seats when `existing` already exist. */
export function calculateMarginalCost(existing: number, addCount: number, type: SeatType): number {
  let total = 0
  for (let i = existing + 1; i <= existing + addCount; i++) {
    total += rateForSeat(i, type)
  }
  return total
}

/** Bracket breakdown for only the added seats (existing+1 .. existing+addCount). */
export function getMarginalBreakdown(existing: number, addCount: number, type: SeatType): BracketLine[] {
  const lines: BracketLine[] = []
  const start = existing + 1
  const end = existing + addCount
  const { brackets, prices } = SEAT_TIERS[type]

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!
    const rate = prices[i]!
    const lo = Math.max(bracket.min, start)
    const hi = Math.min(bracket.max, end)
    if (lo > hi) continue
    const seatsInBracket = hi - lo + 1
    lines.push({ bracket: { min: bracket.min, max: bracket.max }, count: seatsInBracket, rate, subtotal: seatsInBracket * rate })
  }
  return lines
}
