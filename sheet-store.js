// Lectura de la cartera des d'una Google Sheet publicada per enllaç.
// No necessita credencials: la protecció continua sent la del dashboard.

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ZoEGd6xfuPpzpPRa1w2zGY9UstQ1vupSM2PKa88ralE';
const HISTORICAL_SHEET_ID = process.env.HISTORICAL_SHEET_ID || '1wgEWZ9vcP6o6rZR8EKKGSOWhmmzWLpfxQfQ2hi_4L3E';
const CACHE_MS = 60 * 1000;

const TABS = {
  ldm: { name: 'RESUM BROKER LDM', range: 'A1:M25' },
  xcb: { name: 'RESUM BROKER XCB', range: 'A1:M12' },
  fons: { name: 'RESUM FONS ANDORRA', range: 'A1:M10' },
  cash: { name: 'TR.REPLUBIC:LDM', range: 'H133' },
  transactions: { name: 'TR.REPLUBIC:LDM', range: 'A1:M180' }
};

const USD_ETFS = new Set(['BLKC', 'XAID', 'XMME', 'BRIJ', 'XDW0']);

const ASSETS = {
  'ETF BLOCKCHAIN BLKC': { ticker: 'BLKC', type: 'ETF' },
  'SWX:CSEMUS-EUR': { ticker: 'CSEMUS', type: 'ETF' },
  'ETF EUROPE DEFENS DEFS': { ticker: 'DEFS', type: 'ETF' },
  'ETF IA & BIG DATA XAID': { ticker: 'XAID', type: 'ETF' },
  'ETFS MSCI EMERGING XMME': { ticker: 'XMME', type: 'ETF' },
  'ETFS S&P 500 EUR HEDGE IUES': { ticker: 'IUES', type: 'ETF' },
  'SPDR S&P EURO DIVID,ARISTR EUDI': { ticker: 'EUDI', type: 'ETF' },
  'Global X European Infrastructure Development BRIJ': { ticker: 'BRIJ', type: 'ETF' },
  'XTRACKERS WORLD ENERGY XDW0': { ticker: 'XDW0', type: 'ETF' },
  'ISHARES NASDAQ 100 CNDX': { ticker: 'CNDX', type: 'ETF' },
  'ISHARES GLOBAL INFRAESTR.USD DIST. INFR': { ticker: 'INFR', type: 'ETF' }
};

const EXCLUDED_ASSETS = new Set([
  'Adobe Inc',
  'Molson Coors Beverage Co Class B',
  'Amadeus',
  'Puig Brands SA',
  'Ebro Foods SA',
  'Italian Sea Group SpA',
  'adidas AG',
  'Repsol SA',
  'Viscofan SA',
  'PepsiCo Inc',
  'Zoetis Inc',
  'BTC'
]);

const FUNDS = {
  ES0174013021: { ticker: 'CREAND RF', cat: 'Renda fixa' },
  IE00B3K83P04: { ticker: 'POLAR HC', cat: 'Salut' },
  IE00B03HCZ61: { ticker: 'VG GLOBAL', cat: 'Global' },
  IE0031786142: { ticker: 'VG EM', cat: 'Emergents' },
  IE00B42LF923: { ticker: 'VG SMALL', cat: 'Global small cap' }
};

let memoryCache = null;
let memoryCacheAt = 0;

function value(row, index) {
  return row?.c?.[index]?.v ?? null;
}

function finite(valueToCheck) {
  const parsed = Number(valueToCheck);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(valueToCheck) {
  if (typeof valueToCheck === 'number') return finite(valueToCheck);
  const normalized = String(valueToCheck || '').replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  return finite(normalized);
}

function parseSheetDate(valueToCheck) {
  const match = String(valueToCheck || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? '20' + match[3] : match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculaCapitalInicialEtf(rows) {
  const firstPurchases = new Map();
  for (const row of rows) {
    const operation = String(value(row, 2) || '').trim();
    const date = parseSheetDate(row?.c?.[1]?.f || value(row, 1));
    const amount = money(value(row, 5));
    if (!date || amount === null || !/compra/i.test(operation) || !/etf/i.test(operation)) continue;
    const key = operation.toLowerCase().replace(/^compra\s+/, '').trim();
    const previous = firstPurchases.get(key);
    if (!previous || date < previous.date) firstPurchases.set(key, { date, amount });
  }
  const purchases = [...firstPurchases.values()];
  if (!purchases.length) return null;
  const firstDate = new Date(Math.min(...purchases.map(item => item.date.getTime())));
  const lastDate = new Date(Math.max(...purchases.map(item => item.date.getTime())));
  const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return {
    date: iso(firstDate),
    endDate: iso(lastDate),
    value: Math.round(purchases.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    purchases: purchases.length,
    source: 'TR.REPLUBIC:LDM · primera compra de cada ETF'
  };
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function parseGviz(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Resposta no vàlida de Google Sheets');
  const payload = JSON.parse(text.slice(start, end + 1));
  if (payload.status !== 'ok' || !payload.table) {
    throw new Error(payload.errors?.[0]?.detailed_message || 'Google Sheets no ha retornat dades');
  }
  return payload.table.rows || [];
}

async function fetchTab(tab, sheetId = SHEET_ID) {
  const query = new URLSearchParams({
    tqx: 'out:json',
    sheet: tab.name,
    range: tab.range
  });
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${query}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'cartera-dashboard/1.0' }
    });
    if (!response.ok) throw new Error(`Google Sheets ha retornat HTTP ${response.status}`);
    return parseGviz(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHistoricalInitialInvestment() {
  const rows = await fetchTab({ name: 'Hoja1', range: 'A1:B32' }, HISTORICAL_SHEET_ID);
  const totalIndex = rows.findIndex(row => String(value(row, 0) || '').trim().toUpperCase() === 'TOTAL');
  const totalRow = totalIndex > 0 ? rows[totalIndex - 1] : null;
  const initialValue = finite(value(totalRow, 1));
  if (initialValue === null) throw new Error('El total inicial del full històric no és numèric');
  return {
    date: '2021-12-31',
    value: Math.round(initialValue * 100) / 100,
    source: 'CARTERAS DE FONS A 12 05 26 · Hoja1 · total CREDIT ANDORRA'
  };
}

function brokerPosition(row) {
  const originalName = normalizeName(value(row, 0));
  if (!originalName || originalName.toUpperCase() === 'TOTAL') return null;
  if (EXCLUDED_ASSETS.has(originalName)) return null;

  const asset = ASSETS[originalName];
  if (!asset) throw new Error(`Actiu desconegut a la fulla: "${originalName}"`);

  return {
    ticker: asset.ticker,
    name: originalName,
    type: asset.type,
    cat: asset.cat,
    shares: finite(value(row, 1)),
    costPrice: finite(value(row, 2)),
    costTotal: finite(value(row, 3)),
    price: finite(value(row, 4)),
    valueTotal: finite(value(row, 6)),
    periodChangePct: finite(value(row, 11)) === null ? null : finite(value(row, 11)) * 100,
    periodChangeValue: finite(value(row, 12)),
    periodLabel: 'Avui',
    periodApproximate: USD_ETFS.has(asset.ticker),
    cur: '€'
  };
}

function fundPosition(row) {
  const isin = normalizeName(value(row, 1));
  const originalName = normalizeName(value(row, 2));
  if (!isin || !originalName) return null;

  const asset = FUNDS[isin];
  if (!asset) throw new Error(`Fons desconegut a la fulla: "${isin}"`);

  const monthReferenceValue = finite(value(row, 8));
  const currentValue = finite(value(row, 9));

  return {
    ticker: asset.ticker,
    name: originalName,
    isin,
    type: 'Fons',
    cat: asset.cat,
    shares: finite(value(row, 3)),
    costPrice: finite(value(row, 4)),
    price: finite(value(row, 5)),
    costTotal: finite(value(row, 6)),
    valueTotal: finite(value(row, 9)),
    monthChangePct: monthReferenceValue !== null && currentValue !== null
      ? (currentValue / monthReferenceValue - 1) * 100
      : null,
    monthChangeValue: monthReferenceValue !== null && currentValue !== null
      ? currentValue - monthReferenceValue
      : null,
    monthPeriodLabel: 'Mes fins avui',
    periodChangePct: finite(value(row, 11)) === null ? null : finite(value(row, 11)) * 100,
    periodChangeValue: finite(value(row, 12)),
    periodLabel: 'Setmana',
    periodApproximate: false,
    cur: '€'
  };
}

async function loadSheetPortfolio({ force = false } = {}) {
  const now = Date.now();
  if (!force && memoryCache && now - memoryCacheAt < CACHE_MS) return memoryCache;

  const [ldmRows, xcbRows, fundRows, cashRows, transactionRows, initialInvestment] = await Promise.all([
    fetchTab(TABS.ldm),
    fetchTab(TABS.xcb),
    fetchTab(TABS.fons),
    fetchTab(TABS.cash),
    fetchTab(TABS.transactions),
    fetchHistoricalInitialInvestment()
  ]);

  const positions = [
    ...ldmRows.map(brokerPosition),
    ...xcbRows.map(brokerPosition),
    ...fundRows.map(fundPosition)
  ]
    .filter(Boolean)
    .filter(position => position.type === 'ETF' || position.type === 'Fons');

  const configuredCashValue = finite(process.env.CASH_VALUE_EUR);
  const sheetCashValue = finite(value(cashRows[0], 0));
  const cashValue = configuredCashValue ?? sheetCashValue;
  if (cashValue === null) throw new Error('La cel·la TR.REPLUBIC:LDM!H133 no conté un saldo d’efectiu vàlid');

  const tickers = positions.map(position => position.ticker);
  if (new Set(tickers).size !== tickers.length) {
    throw new Error('La fulla conté tickers duplicats');
  }

  memoryCache = {
    positions,
    cashValue: Math.round(cashValue * 100) / 100,
    initialInvestmentByType: { ETF: calculaCapitalInicialEtf(transactionRows) },
    syncedAt: new Date().toISOString(),
    source: 'Google Sheets'
  };
  memoryCache.initialInvestment = initialInvestment;
  memoryCacheAt = now;
  return memoryCache;
}

module.exports = {
  SHEET_ID,
  loadSheetPortfolio
};
