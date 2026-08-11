'use strict';

const assert = require('assert');
const {
  buildAssetScenario,
  cumulativeReturn,
  loadScenarioAssumptions
} = require('./scenario-model');

const assumptions = loadScenarioAssumptions();
assert.equal(assumptions.horizons.length, 3);

const iues = buildAssetScenario('IUES', 0.2, assumptions);
assert(iues);
assert.equal(iues.annualReturnNet, 5);
// A 6 mesos el central ja capitalitza el retorn estructural: (1+5%)^0.5 - 1.
const central6m = (Math.pow(1.05, 0.5) - 1) * 100;
assert(Math.abs(iues.values[0][1] - central6m) < 0.06);
assert(iues.values[0][0] < 0);
assert(iues.values[0][2] > 0);
assert(iues.values[2][0] < iues.values[2][1]);
assert(iues.values[2][1] < iues.values[2][2]);

// Tots els horitzons han de mantenir l'ordre P10 < P50 < P90 i un central positiu
// quan el retorn net també ho és.
iues.values.forEach(([p10, p50, p90]) => {
  assert(p10 < p50 && p50 < p90);
  assert(p50 > 0);
});

const noShock = cumulativeReturn({
  annualReturn: 5,
  volatility: 20,
  years: 5,
  z: 0,
  useReturn: true
});
assert(Math.abs(noShock - 27.628) < 0.01);

assert.equal(buildAssetScenario('NO_EXISTEIX', 0, assumptions), null);

console.log('Scenario model: OK');
