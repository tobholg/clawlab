import {
  SEAT_TIERS,
  MAX_PRO_SEATS,
  rateForSeat,
  calculateSeatCost,
  calculateMarginalCost,
  getSeatBreakdown,
  getMarginalBreakdown,
} from '~~/server/utils/pricing'
import type { SeatType, BracketLine, Tier } from '~~/server/utils/pricing'

export function usePricing() {
  return {
    SEAT_TIERS,
    MAX_PRO_SEATS,
    rateForSeat,
    calculateSeatCost,
    calculateMarginalCost,
    getSeatBreakdown,
    getMarginalBreakdown,
  }
}

export type { SeatType, BracketLine, Tier }
