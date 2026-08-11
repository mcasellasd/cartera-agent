'use strict';

const fs = require('fs');
const path = require('path');

const ASSUMPTIONS_PATH = path.join(__dirname, 'data', 'scenario_assumptions.json');

function loadScenarioAssumptions() {
  return JSON.parse(fs.readFileSync(ASSUMPTIONS_PATH, 'utf8'));
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cumulativeReturn({ annualReturn, volatility, years, z = 0, useReturn = true }) {
  const drift = useReturn ? Math.log1p(annualReturn / 100) * years : 0;
  const shock = z * (volatility / 100) * Math.sqrt(years);
  return (Math.exp(drift + shock) - 1) * 100;
}

function buildAssetScenario(ticker, ter = 0, assumptions = loadScenarioAssumptions()) {
  const asset = assumptions.assets[ticker];
  if (!asset) return null;

  const annualReturnNet = asset.grossReturn - (Number.isFinite(ter) ? ter : 0);
  const values = assumptions.horizons.map(horizon => [
    round(cumulativeReturn({
      annualReturn: annualReturnNet,
      volatility: asset.volatility,
      years: horizon.years,
      z: assumptions.quantiles.zLower,
      useReturn: horizon.useLongTermReturn
    })),
    round(cumulativeReturn({
      annualReturn: annualReturnNet,
      volatility: asset.volatility,
      years: horizon.years,
      z: 0,
      useReturn: horizon.useLongTermReturn
    })),
    round(cumulativeReturn({
      annualReturn: annualReturnNet,
      volatility: asset.volatility,
      years: horizon.years,
      z: assumptions.quantiles.zUpper,
      useReturn: horizon.useLongTermReturn
    }))
  ]);

  return {
    asOf: assumptions.asOf,
    group: asset.group,
    annualReturnGross: asset.grossReturn,
    annualReturnNet: round(annualReturnNet, 2),
    annualVolatility: asset.volatility,
    confidence: asset.confidence,
    basis: asset.basis,
    sourceIds: asset.sourceIds,
    values
  };
}

function scenarioMetadata(assumptions = loadScenarioAssumptions()) {
  return {
    version: assumptions.version,
    asOf: assumptions.asOf,
    quantiles: assumptions.quantiles,
    horizons: assumptions.horizons,
    sources: assumptions.sources,
    correlations: assumptions.correlations,
    limitations: [
      'És una distribució orientativa, no una predicció ni un objectiu de preu.',
      'La volatilitat i les correlacions són hipòtesis de risc, no estimacions en temps real.',
      'No modela explícitament divises, canvis de valoració, impostos ni modificacions futures dels productes.',
      'Els productes temàtics hereten el retorn central del mercat pare: no se suposa alpha futur.'
    ]
  };
}

module.exports = {
  buildAssetScenario,
  cumulativeReturn,
  loadScenarioAssumptions,
  scenarioMetadata
};
