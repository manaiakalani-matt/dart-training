import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

function database() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) { return { bind(...args) {
      return {
        async first() { return { playerId: '641', displayName: 'Matt' }; },
        async all() {
          if (sql.includes('WHERE attempt_id IN')) return { results: args.filter(id => rows.has(id)).map(id => ({ attemptId: id, sessionId: rows.get(id)[1], playerId: rows.get(id)[5] })) };
          if (sql.includes('WHERE session_id =')) return { results: args.slice(2).filter(id => rows.has(id)).map(attemptId => ({ attemptId })) };
          return { results: [] };
        },
        args,
      };
    } }; },
    async batch(statements) { return statements.map(({ args }) => { rows.set(args[0], args); return { meta: { changes: 1 } }; }); },
  };
}
const request = (attempt) => new Request('https://example.test', { method: 'POST', body: JSON.stringify({ action: 'saveSession', sessionId: 'session-test', playerId: '641', trainingDate: '2026-09-10', attempts: [{ attemptId: 'attempt-test', routineId: 'solo-x01', ...attempt }] }) });

test('API persists derived checkout once and accepts safe retries', async () => {
  const DB = database();
  const attempt = { status: 'COMPLETE', resultDisplay: 'forged', values: { start: 170, doubleIn: false, limit: 3, visits: [{ score: 170, checkoutDarts: 3 }] } };
  let response = await worker.fetch(request(attempt), { DB });
  assert.equal(response.status, 200); assert.equal((await response.json()).saved, 1);
  const row = DB.rows.get('attempt-test');
  assert.equal(row[11], 3); assert.equal(row[17], 170); assert.equal(row[21], '3 darts · checked out');
  response = await worker.fetch(request(attempt), { DB });
  const retry = await response.json(); assert.equal(retry.saved, 0); assert.deepEqual(retry.accepted, ['attempt-test']);
});
test('API saves dart-limit attempts but rejects incomplete, abandoned, and forged statuses', async () => {
  const DB = database();
  const values = { start: 501, doubleIn: true, limit: 1, visits: [{ score: 0 }] };
  let response = await worker.fetch(request({ status: 'DART_LIMIT', values }), { DB });
  assert.equal(response.status, 200); assert.equal(DB.rows.get('attempt-test')[21], 'Max 1 darts — no checkout');
  for (const [status, limit] of [['COMPLETE', 1], ['ABANDONED', 1], ['PLAYING', 0], ['DART_LIMIT', 4]]) {
    response = await worker.fetch(request({ status, values: { ...values, limit } }), { DB });
    assert.equal(response.status, 400);
  }
});
test('API rejects impossible finish and extra visits after leg end', async () => {
  for (const visits of [[{ score: 170, checkoutDarts: 2 }], [{ score: 170, checkoutDarts: 3 }, { score: 0 }]]) {
    const response = await worker.fetch(request({ status: 'COMPLETE', values: { start: 170, doubleIn: false, limit: 0, visits } }), { DB: database() });
    assert.equal(response.status, 400);
  }
});
