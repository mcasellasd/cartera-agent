const assert = require('node:assert/strict');
const { buildMarketSentiment, buildMacroOutlook, buildSp500Outlook, makeSeries } = require('./macro-store');

function series(key, value, change = 0, changePct = 0, date = '2026-08-10') {
  return { key, current: { value, date }, change, changePct, change3m: change, change6m: change, change3mPct: changePct, change6mPct: changePct, unit: key === 'hyOas' ? '%' : 'índex', label: key };
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

const outlookSeries = [
  {...series('hyOas', 4.8, 0.7, 16), change3m: 0.7, change6m: 1.1},
  {...series('nfciCredit', 0.25, 0.2, 0), change3m: 0.2, change6m: 0.35},
  {...series('sp500', 5800, -400, -6.4), change3mPct: -6.4, change6mPct: -8.0},
  {...series('nasdaq', 18000, -1500, -7.7), change3mPct: -7.7, change6mPct: -10.0},
  {...series('vix', 30, 8, 36.4), change3mPct: 36.4, change6mPct: 45.0},
  {...series('gpr', 310, 75, 31.8), change3m: 75, change6m: 100}
];
const outlookBlocks = {credit:{level:'alert'},market:{level:'alert'},geopolitical:{level:'watch'}};
const outlook = buildMacroOutlook(outlookSeries, outlookBlocks, stressed);
assert.equal(outlook.credit.direction, 'negative');
assert.equal(outlook.credit.shortLabel, 'Deteriorament probable');
assert.equal(outlook.market.direction, 'negative');
assert.ok(outlook.market.watch.includes('VIX'));
assert.ok(outlook.geopolitical.mediumTerm.includes('3–6 mesos'));

const cpi = makeSeries('inflation', [
  {date:'2025-01-01', value:100}, {date:'2025-02-01', value:100.2}, {date:'2025-03-01', value:100.4},
  {date:'2025-04-01', value:100.6}, {date:'2025-05-01', value:100.8}, {date:'2025-06-01', value:101.0},
  {date:'2025-07-01', value:101.2}, {date:'2025-08-01', value:101.4}, {date:'2025-09-01', value:101.6},
  {date:'2025-10-01', value:101.8}, {date:'2025-11-01', value:102.0}, {date:'2025-12-01', value:102.2},
  {date:'2026-01-01', value:103}, {date:'2026-02-01', value:103.2}
]);
assert.equal(cpi.unit, '%');
assert.ok(Math.abs(cpi.current.value - 3) < 0.01);
assert.equal(cpi.current.raw, 103.2);
assert.ok(cpi.observations.length > 0);

const sp500Outlook = buildSp500Outlook([
  {...series('sp500', 6400, 80, 1.3), change3mPct: 5.2, change6mPct: 8.1},
  {...series('nasdaq', 21000, 400, 1.9), change3mPct: 6.4},
  {...series('vix', 15.2, -1.1, -6.7), changePct: -12},
  {...series('hyOas', 3.1, -0.08, -2.5), changePct: -8}
]);
assert.equal(sp500Outlook.level, 'positive');
assert.equal(sp500Outlook.shortLabel, 'Continuïtat probable');
assert.equal(sp500Outlook.available, 4);

console.log('Market sentiment: OK');
