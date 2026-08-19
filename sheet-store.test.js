'use strict';

const assert = require('node:assert/strict');
const { brokerPosition, fundPosition, fixedIncomePosition } = require('./sheet-store');

function row(values) {
  return { c: values.map(value => value === undefined ? null : { v: value }) };
}

const etf = brokerPosition(row([
  'ISHARES NASDAQ 100 CNDX', 3, 100, 300, 101, null, 303, 3, 0.01, 0.1, 100, 0.0048, 1.44
]));
assert.equal(etf.periodChangePct, 0.48);
assert.equal(etf.periodChangeValue, 1.44);

const fund = fundPosition(row([
  'CREDIT ANDORRA', 'IE00B03HCZ61', 'Vanguard Global Stock Index Fund Investor EUR Accumulation',
  10, 50, 55, 500, 505, 510, 515, 520, 518, 0.003861003861
]));
assert.equal(fund.valueTotal, 520);
assert.equal(fund.monthChangePct, (520 / 510 - 1) * 100);
assert.ok(Math.abs(fund.periodChangePct - 0.3861003861) < 1e-9);
assert.equal(fund.periodChangeValue, 2);

const fixedIncome = fixedIncomePosition(row([
  null, 'FI0008800511', 'EVLI SHO, CORPORATE BOND', 10, 50, 500, 52, 500, 501, 502, 503, 504, 502, 0.003984063745
]));
assert.equal(fixedIncome.valueTotal, 504);
assert.ok(Math.abs(fixedIncome.periodChangePct - 0.3984063745) < 1e-9);
assert.equal(fixedIncome.periodChangeValue, 2);

console.log('Sheet period changes: OK');
