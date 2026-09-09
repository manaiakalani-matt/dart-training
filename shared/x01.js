// Shared by the browser and save API so saved legs obey the same rules.
export const startingScores = [170, 201, 301, 501, 701];
const doubles = Array.from({ length: 20 }, (_, i) => (i + 1) * 2).concat(50);
const segments = [...new Set([0, 25, 50, ...Array.from({ length: 20 }, (_, i) => i + 1), ...doubles, ...Array.from({ length: 20 }, (_, i) => (i + 1) * 3)])];

function possible(score, darts, doubleIn = false, doubleOut = false) {
  if (darts < 1) return score === 0 && !doubleIn && !doubleOut;
  const choices = doubleIn || (doubleOut && darts === 1) ? doubles : segments;
  return choices.some(value => value <= score && (darts === 1
    ? value === score && (!doubleOut || doubles.includes(value))
    : possible(score - value, darts - 1, false, doubleOut)));
}

export function canCheckout(score, darts, doubleIn = false) {
  return Number.isInteger(darts) && darts >= 1 && darts <= 3 && possible(score, darts, doubleIn, true);
}

export function createLeg(start, doubleIn = false, limit = 0) {
  if (!startingScores.includes(start)) throw new Error("Choose 170, 201, 301, 501 or 701.");
  if (typeof doubleIn !== "boolean") throw new Error("Choose an entry rule.");
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("Enter a whole dart limit, or leave it blank for unlimited.");
  return { start, doubleIn, limit, remaining: start, opened: !doubleIn, darts: 0, visits: [], status: "PLAYING" };
}

export function visitDarts(leg) {
  return leg.limit ? Math.min(3, leg.limit - leg.darts) : 3;
}

export function submitVisit(leg, input) {
  if (leg.status !== "PLAYING") throw new Error("This leg has ended.");
  const { score, doubleInHit = false, checkoutDarts = 0, bust = false } = input;
  const available = visitDarts(leg);
  if (!Number.isInteger(score) || score < 0 || score > 180) throw new Error("Enter a whole score from 0 to 180.");
  if (typeof doubleInHit !== "boolean" || typeof bust !== "boolean") throw new Error("Invalid visit confirmation.");
  if (!Number.isInteger(checkoutDarts) || checkoutDarts < 0 || checkoutDarts > available) throw new Error("Invalid checkout dart count.");
  if (bust && checkoutDarts) throw new Error("A bust cannot be a checkout.");
  const opening = !leg.opened && doubleInHit;
  const opened = leg.opened || doubleInHit;
  if (!opened && score !== 0) throw new Error("No double in: record zero.");
  if (!bust && !possible(score, checkoutDarts || available, opening, Boolean(checkoutDarts))) {
    throw new Error("That score is not possible with the available darts and entry/finish rules.");
  }
  const attempted = opened ? leg.remaining - score : leg.remaining;
  if (checkoutDarts && (!opened || attempted !== 0)) throw new Error("Checkout must reach zero on a double.");
  const isBust = bust || (opened && (attempted < 0 || attempted === 1 || (attempted === 0 && !checkoutDarts)));
  const remaining = isBust ? leg.remaining : attempted;
  const darts = leg.darts + (checkoutDarts || available);
  const status = checkoutDarts ? "COMPLETE" : leg.limit && darts === leg.limit ? "DART_LIMIT" : "PLAYING";
  const visit = { score, doubleInHit, checkoutDarts, bust, remaining, isBust, darts: checkoutDarts || available };
  return { ...leg, remaining, opened, darts, status, visits: [...leg.visits, visit] };
}

export function replayLeg(start, doubleIn, limit, visits) {
  if (!Array.isArray(visits) || !visits.length || visits.length > 10000) throw new Error("Invalid leg visits.");
  return visits.reduce((leg, visit) => submitVisit(leg, visit), createLeg(start, doubleIn, limit));
}

export function legDisplay(leg) {
  return leg.status === "COMPLETE" ? `${leg.darts} darts · checked out` : `Max ${leg.limit} darts — no checkout`;
}
