const assert = require('node:assert/strict');
const { buildMarketSentiment } = require('./macro-store');

function series(key, value, change = 0, changePct = 0, date = '2026-08-10') {
  return { key, current: { value, date }, change, changePct };
}

const calm = buildMarketSentiment([
  series('vix', 15.2, -1.1, -6.7),
  series('sp500', 6400, 80, 1.3),
  series('nasdaq', 21000, 400, 1.9),
  series('hyOas', 3.1, -0.08, -2.5),
  series('gpr', 95, -4, -4.0)
]);

assert.equal(calm.level, 'ok');
assert.equal(calm.label, 'Constructiu');
assert.equal(calm.score, 0);
assert.equal(calm.availableComponents, 4);

const stressed = buildMarketSentiment([
  series('vix', 30, 8, 36.4),
  series('sp500', 5800, -400, -6.4),
  series('nasdaq', 18000, -1500, -7.7),
  series('hyOas', 5.6, 1.0, 21.7),
  series('gpr', 310, 75, 31.8)
]);

assert.equal(stressed.level, 'alert');
assert.equal(stressed.label, 'Tensió');
assert.equal(stressed.score, 8);
assert.equal(stressed.maxScore, 8);
assert.ok(stressed.reason.includes('vix'));

const incomplete = buildMarketSentiment([
  series('vix', 18),
  series('sp500', 6400, 20, 0.3)
]);

assert.equal(incomplete.level, 'unknown');
assert.equal(incomplete.label, 'Sense dades suficients');
assert.equal(incomplete.score, null);
assert.equal(incomplete.availableComponents, 2);

console.log('Market sentiment: OK');
