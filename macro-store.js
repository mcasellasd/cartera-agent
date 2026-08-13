// Dades macro de fonts oficials via FRED. El dashboard les tracta com a dades
// de vigilància: conserva la data de cada observació i no omple buits.

const XLSX = require('xlsx');

const SERIES = {
  nfci: {
    id: 'NFCI', label: 'Condicions financeres (NFCI)', unit: 'índex', freq: 'setmanal',
    source: 'Chicago Fed via FRED', url: 'https://fred.stlouisfed.org/series/NFCI'
  },
  nfciCredit: {
    id: 'NFCICREDIT', label: 'Subíndex de crèdit NFCI', unit: 'índex', freq: 'setmanal',
    source: 'Chicago Fed via FRED', url: 'https://fred.stlouisfed.org/series/NFCICREDIT'
  },
  hyOas: {
    id: 'BAMLH0A0HYM2', label: 'Spread high yield (OAS)', unit: '%', freq: 'diària',
    source: 'ICE BofA via FRED', url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2'
  },
  curve: {
    id: 'T10Y3M', label: 'Corba 10 anys − 3 mesos', unit: 'punts percentuals', freq: 'diària',
    source: 'U.S. Treasury via FRED', url: 'https://fred.stlouisfed.org/series/T10Y3M'
  },
  claims: {
    id: 'ICSA', label: 'Sol·licituds inicials d’atur', unit: 'milers', freq: 'setmanal',
    source: 'U.S. Bureau of Labor Statistics via FRED', url: 'https://fred.stlouisfed.org/series/ICSA'
  },
  freight: {
    id: 'TSIFRGHT', label: 'Freight Transportation Services Index', unit: 'índex', freq: 'mensual',
    source: 'U.S. Bureau of Transportation Statistics via FRED', url: 'https://fred.stlouisfed.org/series/TSIFRGHT'
  },
  starts: {
    id: 'HOUST', label: 'Inicis d’habitatge', unit: 'milers anualitzats', freq: 'mensual',
    source: 'U.S. Census Bureau via FRED', url: 'https://fred.stlouisfed.org/series/HOUST'
  },
  sentiment: {
    id: 'UMCSENT', label: 'Confiança del consumidor', unit: 'índex', freq: 'mensual',
    source: 'University of Michigan via FRED', url: 'https://fred.stlouisfed.org/series/UMCSENT'
  },
  revolving: {
    id: 'REVOLNS', label: 'Crèdit revolving al consumidor', unit: 'milions de $', freq: 'mensual',
    source: 'Federal Reserve Board via FRED', url: 'https://fred.stlouisfed.org/series/REVOLNS'
  },
  delinq: {
    id: 'DRCCLACBN', label: 'Morositat de targetes', unit: '%', freq: 'trimestral',
    source: 'Federal Reserve Board via FRED', url: 'https://fred.stlouisfed.org/series/DRCCLACBN'
  },
  sofr: {
    id: 'SOFR', label: 'SOFR', unit: '%', freq: 'diària',
    source: 'Federal Reserve Bank of New York via FRED', url: 'https://fred.stlouisfed.org/series/SOFR'
  },
  effr: {
    id: 'EFFR', label: 'Effective Federal Funds Rate', unit: '%', freq: 'diària',
    source: 'Federal Reserve Bank of New York via FRED', url: 'https://fred.stlouisfed.org/series/EFFR'
  },
  walcl: {
    id: 'WALCL', label: 'Actius totals de la Reserva Federal', unit: 'milions de $', freq: 'setmanal',
    source: 'Federal Reserve Board via FRED', url: 'https://fred.stlouisfed.org/series/WALCL'
  },
  wtregen: {
    id: 'WTREGEN', label: 'Compte del Tresor a la Fed (TGA)', unit: 'milions de $', freq: 'setmanal',
    source: 'Federal Reserve Board via FRED', url: 'https://fred.stlouisfed.org/series/WTREGEN'
  },
  rrpontsyd: {
    id: 'RRPONTSYD', label: 'Reverse repo overnight', unit: 'bilions de $', freq: 'diària',
    source: 'Federal Reserve Bank of New York via FRED', url: 'https://fred.stlouisfed.org/series/RRPONTSYD'
  },
  wresbal: {
    id: 'WRESBAL', label: 'Reserves bancàries a la Fed', unit: 'milions de $', freq: 'setmanal',
    source: 'Federal Reserve Board via FRED', url: 'https://fred.stlouisfed.org/series/WRESBAL'
  },
  profits: {
    id: 'CP', label: 'Beneficis corporatius després d’impostos', unit: 'milers de milions $', freq: 'trimestral',
    source: 'U.S. Bureau of Economic Analysis via FRED', url: 'https://fred.stlouisfed.org/series/CP'
  },
  sp500: {
    id: 'SP500', label: 'S&P 500', unit: 'índex', freq: 'diària',
    source: 'S&P Dow Jones Indices via FRED', url: 'https://fred.stlouisfed.org/series/SP500'
  },
  nasdaq: {
    id: 'NASDAQCOM', label: 'Nasdaq Composite', unit: 'índex', freq: 'diària',
    source: 'Nasdaq via FRED', url: 'https://fred.stlouisfed.org/series/NASDAQCOM'
  },
  vix: {
    id: 'VIXCLS', label: 'Volatilitat implícita (VIX)', unit: 'índex', freq: 'diària',
    source: 'Cboe via FRED', url: 'https://fred.stlouisfed.org/series/VIXCLS'
  },
  gpr: {
    id: 'GPRD', label: 'Índex de risc geopolític (GPR)', unit: 'índex (1985–2019=100)', freq: 'diària',
    source: 'Caldara–Iacoviello', url: 'https://www.matteoiacoviello.com/gpr.htm'
  }
};

const CACHE_MS = 15 * 60 * 1000;
let cache = { fetchedAt: 0, payload: null };

function parseCsv(csv) {
  const lines = String(csv).trim().split(/\r?\n/).slice(1);
  return lines.map(line => {
    const [date, raw] = line.split(',');
    const value = Number(raw);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function observations(values, count = 260) {
  return values.filter(x => x.value !== null).slice(-count);
}

function last(values) { return values[values.length - 1] || null; }
function atOrBefore(values, iso) {
  for (let i = values.length - 1; i >= 0; i -= 1) if (values[i].date <= iso) return values[i];
  return null;
}
function changePct(current, previous) {
  if (!current || !previous || previous.value === 0) return null;
  return (current.value / previous.value - 1) * 100;
}
function delta(current, previous) {
  if (!current || !previous) return null;
  return current.value - previous.value;
}
function avg(values) {
  if (!values.length) return null;
  return values.reduce((sum, x) => sum + x.value, 0) / values.length;
}
function recentAvg(values, n) { return avg(values.slice(-n)); }
function dateDaysAgo(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function download(id) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`, {
        headers: { accept: 'text/csv', 'user-agent': 'cartera-agent/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const values = parseCsv(await response.text());
      if (!values.length) throw new Error('resposta sense observacions');
      return values;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`FRED ${id}: ${lastError?.message || 'error desconegut'}`);
}

async function limitedMap(entries, limit, worker) {
  const output = new Array(entries.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= entries.length) return;
      output[index] = await worker(entries[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, entries.length) }, run));
  return output;
}

async function downloadGpr() {
  const response = await fetch('https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls', {
    headers: { 'user-agent': 'cartera-agent/1.0' }, signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`GPR: HTTP ${response.status}`);
  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null });
  return rows.slice(1).filter(row => /^\d{8}$/.test(String(row[0])) && Number.isFinite(Number(row[6]))).map(row => ({
    date: `${String(row[0]).slice(0, 4)}-${String(row[0]).slice(4, 6)}-${String(row[0]).slice(6, 8)}`,
    value: Number(row[6]),
    raw: Number(row[2])
  }));
}

function makeSeries(key, values) {
  const meta = SERIES[key];
  const data = observations(values);
  const current = last(data);
  const previous = current ? atOrBefore(data, dateDaysAgo(current.date, meta.freq === 'diària' ? 30 : meta.freq === 'setmanal' ? 91 : 90)) : null;
  const yearAgo = current ? atOrBefore(data, dateDaysAgo(current.date, 365)) : null;
  return {
    key, id: meta.id, label: meta.label, unit: meta.unit, frequency: meta.freq,
    source: meta.source, url: meta.url, current, change: delta(current, previous),
    changePct: changePct(current, previous), change13w: delta(current, current ? atOrBefore(data, dateDaysAgo(current.date, 91)) : null),
    yearChange: delta(current, yearAgo),
    observations: data.slice(-80),
    latestRaw: current?.raw ?? null
  };
}

function buildLiquidityNet(raw) {
  const fed = raw.walcl, tga = raw.wtregen, rrp = raw.rrpontsyd;
  if (!Array.isArray(fed) || !Array.isArray(tga) || !Array.isArray(rrp)) return null;
  const values = fed.map(point => {
    const tgaPoint = atOrBefore(tga, point.date);
    const rrpPoint = atOrBefore(rrp, point.date);
    if (!tgaPoint || !rrpPoint) return null;
    // RRPONTSYD ve en bilions de dòlars; WALCL i WTREGEN, en milions.
    return { date: point.date, value: point.value - tgaPoint.value - rrpPoint.value * 1000 };
  }).filter(Boolean);
  return values.length ? values : null;
}

function assess(series) {
  const s = Object.fromEntries(series.map(x => [x.key, x]));
  const n = key => s[key]?.current?.value;
  const d = key => s[key]?.change;
  const p = key => s[key]?.changePct;
  const status = (level, reason) => ({ level, reason });

  const credit = (n('hyOas') >= 5 || d('hyOas') >= 0.75 || d('nfciCredit') >= 0.3)
    ? status('alert', 'L’OAS high yield o el subíndex de crèdit s’han tensat amb força.')
    : (n('hyOas') >= 4 || d('hyOas') >= 0.25 || d('nfciCredit') >= 0.12)
      ? status('watch', 'Cal confirmar si l’ampliació dels spreads persisteix.')
      : status('ok', 'Sense ampliació recent prou gran en els indicadors disponibles.');
  const financial = (n('nfci') >= 0.5 || d('nfci') >= 0.25)
    ? status('alert', 'Les condicions financeres són clarament més estrictes que la mitjana.')
    : (n('nfci') >= 0 || d('nfci') >= 0.1)
      ? status('watch', 'Les condicions s’apropen a la mitjana o s’han endurit recentment.')
      : status('ok', 'NFCI negatiu: condicions més laxes que la mitjana històrica.');
  const curve = (n('curve') < 0)
    ? status('watch', 'La corba 10a−3m continua invertida; la normalització s’ha d’interpretar amb activitat i crèdit.')
    : (d('curve') !== null && d('curve') > 0.4 && n('claims') !== null && p('claims') > 5)
      ? status('alert', 'Re-steepening de la corba alhora que augmenta la pressió del mercat laboral.')
      : status('ok', 'La corba no està invertida en la darrera observació disponible.');
  const interbankSpread = n('sofr') !== null && n('effr') !== null ? n('sofr') - n('effr') : null;
  const interbank = (interbankSpread !== null && interbankSpread >= 0.25)
    ? status('alert', 'El diferencial SOFR−EFFR suggereix tensió en el finançament overnight.')
    : (interbankSpread !== null && interbankSpread >= 0.10)
      ? status('watch', 'El diferencial SOFR−EFFR s’ha d’observar com a possible fricció de liquiditat.')
      : status('ok', 'No s’observa una tensió gran en el diferencial SOFR−EFFR disponible.');
  const consumerStress = (p('revolving') >= 4 && d('delinq') !== null && d('delinq') >= 0.2)
    ? status('alert', 'El crèdit revolving creix alhora que empitjora la morositat de targetes.')
    : (p('revolving') >= 3 || (d('delinq') !== null && d('delinq') >= 0.1))
      ? status('watch', 'El finançament revolving o la morositat mostren una pressió que cal confirmar.')
      : status('ok', 'No hi ha deteriorament conjunt prou gran en crèdit revolving i morositat.');
  const activity = (p('claims') >= 10 || (d('sentiment') !== null && d('sentiment') <= -8) || p('starts') <= -12 || p('freight') <= -8)
    ? status('alert', 'Diversos indicadors d’activitat mostren deteriorament rellevant.')
    : (p('claims') >= 5 || (d('sentiment') !== null && d('sentiment') <= -3) || p('starts') <= -6 || p('freight') <= -3)
      ? status('watch', 'Hi ha pèrdua de dinamisme en ocupació, transport, habitatge o confiança; cal esperar confirmació.')
      : status('ok', 'No hi ha deteriorament agregat prou gran en les sèries disponibles.');
  const earnings = (p('profits') !== null && p('profits') <= -5)
    ? status('alert', 'Els beneficis corporatius agregats han caigut respecte del trimestre anterior.')
    : (p('profits') !== null && p('profits') <= 0)
      ? status('watch', 'Els beneficis corporatius no estan accelerant en la darrera observació.')
      : status('ok', 'Els beneficis corporatius agregats no mostren una caiguda recent.');
  const market = ((p('sp500') !== null && p('sp500') < -5) || (n('vix') >= 25 && p('sp500') < 0))
    ? status('alert', 'El mercat de renda variable està feble i la volatilitat és elevada.')
    : ((p('sp500') !== null && p('sp500') < 0) || (n('vix') >= 20) || (p('nasdaq') !== null && p('sp500') !== null && p('nasdaq') < p('sp500') - 3))
      ? status('watch', 'La confirmació del mercat és mixta: vigila preu, volatilitat i lideratge.')
      : status('ok', 'Preus i volatilitat no mostren una confirmació negativa en l’últim període.');
  const geopolitical = (n('gpr') >= 250 || d('gpr') >= 60)
    ? status('alert', 'El GPR suavitzat està en nivells molt elevats o ha augmentat ràpidament.')
    : (n('gpr') >= 150 || d('gpr') >= 25)
      ? status('watch', 'El GPR suavitzat està per sobre de la seva referència històrica o puja amb força.')
      : status('ok', 'El GPR suavitzat no mostra una tensió geopolítica excepcional.');
  const liquidity = (d('liquidityNet') !== null && d('liquidityNet') <= -300)
    ? status('alert', 'La liquiditat neta ha caigut amb força en les darreres setmanes.')
    : (d('liquidityNet') !== null && d('liquidityNet') <= -100)
      ? status('watch', 'La liquiditat neta s’ha reduït; cal contrastar-la amb crèdit i condicions financeres.')
      : status('ok', 'La liquiditat neta no mostra una contracció recent prou gran.');
  const blocks = { credit, financial, curve, earnings, activity, interbank, consumerStress, liquidity, market, geopolitical };
  const required = {
    credit: ['hyOas', 'nfciCredit'], financial: ['nfci'], curve: ['curve'], earnings: ['profits'],
    activity: ['claims', 'freight', 'starts', 'sentiment'], consumerStress: ['revolving', 'delinq'],
    interbank: ['sofr', 'effr'], liquidity: ['liquidityNet'], market: ['sp500', 'nasdaq', 'vix'], geopolitical: ['gpr']
  };
  Object.entries(required).forEach(([key, keys]) => {
    if (!keys.some(item => s[item]?.current)) {
      blocks[key] = status('unknown', 'No hi ha cap observació disponible en aquest bloc; no es pot interpretar com a normal.');
    }
  });
  const assessed = Object.values(blocks);
  return {
    blocks,
    score: assessed.filter(x => x.level === 'alert').length,
    availableBlocks: assessed.filter(x => x.level !== 'unknown').length,
    unavailableBlocks: assessed.filter(x => x.level === 'unknown').length
  };
}

async function loadMacro({ force = false } = {}) {
  if (!force && cache.payload && Date.now() - cache.fetchedAt < CACHE_MS) return cache.payload;
  const entries = await limitedMap(Object.entries(SERIES), 5, async ([key, meta]) => {
    try { return [key, key === 'gpr' ? await downloadGpr() : await download(meta.id)]; }
    catch (error) { return [key, { error: error.message }]; }
  });
  const raw = Object.fromEntries(entries);
  const liquidityNet = buildLiquidityNet(raw);
  const series = Object.entries(raw).filter(([, values]) => Array.isArray(values)).map(([key, values]) => makeSeries(key, values));
  if (liquidityNet) series.push({
    ...makeSeries('walcl', liquidityNet), key: 'liquidityNet', id: 'WALCL−WTREGEN−RRPONTSYD',
    label: 'Liquiditat neta EUA', unit: 'milions de $', frequency: 'setmanal',
    source: 'Càlcul propi amb sèries Fed via FRED',
    url: 'https://fred.stlouisfed.org/series/WALCL', observations: liquidityNet.slice(-80)
  });
  const errors = Object.entries(raw).filter(([, values]) => !Array.isArray(values)).map(([key, values]) => ({ key, error: values.error }));
  if (!series.length) throw new Error('FRED no ha retornat cap sèrie. Comprova la connexió del servidor.');
  const assessment = assess(series);
  const payload = { fetchedAt: new Date().toISOString(), series, assessment, errors,
    sources: [...new Set(series.map(x => ({ name: x.source, url: x.url })).map(x => JSON.stringify(x)))].map(x => JSON.parse(x)) };
  cache = { fetchedAt: Date.now(), payload };
  return payload;
}

module.exports = { loadMacro, SERIES };
