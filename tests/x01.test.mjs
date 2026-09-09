import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeg, submitVisit, canCheckout, replayLeg, legDisplay } from '../shared/x01.js';

test('all five starting scores and strict settings', () => {
  for (const score of [170, 201, 301, 501, 701]) assert.equal(createLeg(score).remaining, score);
  for (const score of [0, 401, '501']) assert.throws(() => createLeg(score));
  for (const cap of [-1, 1.5, NaN, Infinity]) assert.throws(() => createLeg(501, false, cap));
});
test('straight-in three-dart visits and double-out checkout', () => {
  let leg = submitVisit(createLeg(201), { score: 100 });
  leg = submitVisit(leg, { score: 61 });
  leg = submitVisit(leg, { score: 40, checkoutDarts: 1 });
  assert.equal(leg.status, 'COMPLETE'); assert.equal(leg.darts, 7); assert.equal(leg.remaining, 0);
  assert.throws(() => submitVisit(leg, { score: 0 }));
});
test('bust restores score and charges the visit; zero without double is bust', () => {
  const leg = submitVisit(createLeg(170), { score: 130 });
  for (const score of [40, 39, 60]) {
    const bust = submitVisit(leg, { score });
    assert.equal(bust.remaining, 40); assert.equal(bust.darts, 6); assert.equal(bust.visits[1].isBust, true);
  }
});
test('double-in misses count darts and an opening survives a later bust', () => {
  let leg = submitVisit(createLeg(170, true), { score: 0 });
  assert.equal(leg.opened, false); assert.equal(leg.darts, 3);
  assert.throws(() => submitVisit(leg, { score: 60 }));
  assert.throws(() => submitVisit(leg, { score: 180, doubleInHit: true }));
  leg = submitVisit(leg, { score: 170, doubleInHit: true });
  assert.equal(leg.remaining, 170); assert.equal(leg.opened, true);
});
test('checkout feasibility respects double-out and double-in', () => {
  assert.equal(canCheckout(170, 3), true); assert.equal(canCheckout(170, 2), false);
  assert.equal(canCheckout(169, 3), false); assert.equal(canCheckout(50, 1), true);
  assert.equal(canCheckout(60, 1), false); assert.equal(canCheckout(170, 3, true), false);
  assert.throws(() => submitVisit(createLeg(170), { score: 170, checkoutDarts: 2 }));
});
test('50 dart limit has a two-dart final visit and saves no checkout', () => {
  let leg = createLeg(501, false, 50);
  for (let i = 0; i < 16; i++) leg = submitVisit(leg, { score: 0 });
  assert.throws(() => submitVisit(leg, { score: 121 }));
  leg = submitVisit(leg, { score: 120 });
  assert.equal(leg.darts, 50); assert.equal(leg.status, 'DART_LIMIT'); assert.equal(leg.remaining, 381);
  assert.equal(legDisplay(leg), 'Max 50 darts — no checkout');
});
test('checkout on last allowed dart wins over limit', () => {
  let leg = submitVisit(createLeg(170, false, 4), { score: 130 });
  leg = submitVisit(leg, { score: 40, checkoutDarts: 1 });
  assert.equal(leg.status, 'COMPLETE'); assert.equal(leg.darts, 4);
});
test('short final bust counts only remaining darts', () => {
  const leg = submitVisit(createLeg(501, true, 1), { score: 0, bust: true });
  assert.equal(leg.status, 'DART_LIMIT'); assert.equal(leg.darts, 1); assert.equal(leg.remaining, 501);
});
test('replay derives results from inputs, ignoring client summaries', () => {
  const leg = replayLeg(170, false, 3, [{ score: 170, checkoutDarts: 3, remaining: 999, darts: 999 }]);
  assert.equal(leg.remaining, 0); assert.equal(leg.darts, 3);
  assert.throws(() => replayLeg(170, false, 3, [{ score: 170, checkoutDarts: 3 }, { score: 0 }]));
});
