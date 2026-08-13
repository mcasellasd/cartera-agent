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
  let fredError;
  // Les funcions serverless poden trigar més en la primera connexió TLS a FRED.
  // 3,5 s provocava falsos buits: la font respon, però després del timeout.
  const attempts = 2;
  const timeoutMs = process.env.VERCEL ? 10000 : 10000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`, {
        headers: { accept: 'text/csv', 'user-agent': 'cartera-agent/1.0' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const values = parseCsv(await response.text());
      if (!values.length) throw new Error('resposta sense observacions');
      return { values, via: 'FRED directe' };
    } catch (error) {
      fredError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  // Vercel pot rebutjar o retardar el CSV de FRED. DBnomics redistribueix
  // les mateixes sèries originals amb una resposta JSON més estable per a
  // funcions serverless; la font econòmica continua sent FRED.
  try {
    const response = await fetch(`https://api.db.nomics.world/v22/series/FRED/${encodeURIComponent(id)}?observations=1`, {
      headers: { accept: 'application/json', 'user-agent': 'cartera-agent/1.0' },
      signal: AbortSignal.timeout(process.env.VERCEL ? 6000 : 10000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const doc = payload?.series?.docs?.[0] || payload?.series?.[0] || payload?.data?.series?.docs?.[0];
    const periods = doc?.period || doc?.periods || doc?.observation_period || [];
    const values = doc?.value || doc?.values || [];
    const parsed = periods.map((date, index) => ({ date: String(date).slice(0, 10), value: Number(values[index]) }))
      .filter(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value));
    if (!parsed.length) throw new Error('resposta sense observacions');
    return { values: parsed, via: 'DBnomics · mirall de FRED' };
  } catch (mirrorError) {
    throw new Error(`FRED: ${fredError?.message || 'error'}; DBnomics: ${mirrorError.message}`);
  }
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
    headers: { 'user-agent': 'cartera-agent/1.0' }, signal: AbortSignal.timeout(process.env.VERCEL ? 8000 : 20000)
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
  const threeMonthsAgo = current ? atOrBefore(data, dateDaysAgo(current.date, 91)) : null;
  const sixMonthsAgo = current ? atOrBefore(data, dateDaysAgo(current.date, 182)) : null;
  const yearAgo = current ? atOrBefore(data, dateDaysAgo(current.date, 365)) : null;
  return {
    key, id: meta.id, label: meta.label, unit: meta.unit, frequency: meta.freq,
    source: meta.source, url: meta.url, current, change: delta(current, previous),
    changePct: changePct(current, previous),
    change3m: delta(current, threeMonthsAgo), change3mPct: changePct(current, threeMonthsAgo),
    change6m: delta(current, sixMonthsAgo), change6mPct: changePct(current, sixMonthsAgo),
    change13w: delta(current, threeMonthsAgo),
    yearChange: delta(current, yearAgo),
    observations: data.slice(-80),
    latestRaw: current?.raw ?? null
  };
}

function buildMarketSentiment(series) {
  const byKey = Object.fromEntries(series.map(item => [item.key, item]));
  const current = key => byKey[key]?.current || null;
  const changePct = key => byKey[key]?.changePct ?? null;
  const value = key => current(key)?.value ?? null;
  const date = key => current(key)?.date || null;
  const levelFor = (score) => score >= 2 ? 'alert' : score >= 1 ? 'watch' : 'ok';
  const component = (key, label, level, details) => ({ key, label, level, ...details });

  const vixValue = value('vix');
  const vixLevel = vixValue === null ? 'unknown' : levelFor(vixValue >= 25 ? 2 : vixValue >= 20 ? 1 : 0);
  const vix = component('vix', 'VIX · por i volatilitat', vixLevel, {
    value: vixValue,
    unit: 'índex',
    date: date('vix'),
    changePct: changePct('vix'),
    explanation: 'Mesura la volatilitat que el mercat d’opcions espera per a l’S&P 500; no és una predicció de direcció.'
  });

  const spChange = changePct('sp500');
  const nasdaqChange = changePct('nasdaq');
  const priceAvailable = spChange !== null || nasdaqChange !== null;
  const priceLevel = !priceAvailable ? 'unknown' : levelFor(
    (spChange !== null && spChange <= -5) ? 2 :
      ((spChange !== null && spChange < 0) || (nasdaqChange !== null && spChange !== null && nasdaqChange < spChange - 3)) ? 1 : 0
  );
  const price = component('priceTrend', 'Tendència de la borsa', priceLevel, {
    sp500ChangePct: spChange,
    nasdaqChangePct: nasdaqChange,
    date: [date('sp500'), date('nasdaq')].filter(Boolean).sort().pop() || null,
    explanation: 'Compara el moviment recent dels dos índexs; una pujada sostinguda només per pocs valors pot amagar una participació feble.'
  });

  const hyValue = value('hyOas');
  const hyChange = byKey.hyOas?.change ?? null;
  const creditLevel = hyValue === null && hyChange === null ? 'unknown' : levelFor(
    (hyValue !== null && hyValue >= 5) || (hyChange !== null && hyChange >= 0.75) ? 2 :
      ((hyValue !== null && hyValue >= 4) || (hyChange !== null && hyChange >= 0.25)) ? 1 : 0
  );
  const credit = component('credit', 'Crèdit high yield', creditLevel, {
    value: hyValue,
    unit: '%',
    change: hyChange,
    date: date('hyOas'),
    explanation: 'L’OAS high yield és la prima que demanen els inversors per assumir risc d’impagament; si s’obre, el finançament es torna més car.'
  });

  const gprValue = value('gpr');
  const gprChange = byKey.gpr?.change ?? null;
  const gprLevel = gprValue === null && gprChange === null ? 'unknown' : levelFor(
    (gprValue !== null && gprValue >= 250) || (gprChange !== null && gprChange >= 60) ? 2 :
      ((gprValue !== null && gprValue >= 150) || (gprChange !== null && gprChange >= 25)) ? 1 : 0
  );
  const geopolitical = component('gpr', 'Risc geopolític', gprLevel, {
    value: gprValue,
    unit: 'índex',
    change: gprChange,
    date: date('gpr'),
    explanation: 'Compta la intensitat de notícies sobre risc geopolític; no calcula la probabilitat d’una guerra ni el seu impacte borsari.'
  });

  const components = [vix, price, credit, geopolitical];
  const availableComponents = components.filter(item => item.level !== 'unknown');
  const rawScore = availableComponents.reduce((sum, item) => sum + (item.level === 'alert' ? 2 : item.level === 'watch' ? 1 : 0), 0);
  const sufficient = availableComponents.length >= 3;
  const score = sufficient ? rawScore : null;
  const level = !sufficient ? 'unknown' : score >= 6 ? 'alert' : score >= 1 ? 'watch' : 'ok';
  const label = !sufficient ? 'Sense dades suficients' : score >= 6 ? 'Tensió' : score >= 4 ? 'Prudent' : score >= 1 ? 'Mixt' : 'Constructiu';
  const stressed = availableComponents.filter(item => item.level !== 'ok').map(item => item.label.toLowerCase());
  const reason = !sufficient
    ? 'Calen almenys tres dels quatre components per formar una lectura; l’absència de dades no es considera una situació normal.'
    : stressed.length
      ? `El sentiment és ${label.toLowerCase()} perquè ${stressed.join(', ')} ${stressed.length === 1 ? 'mostra' : 'mostren'} senyals de prudència.`
      : 'Els quatre components no mostren una pressió conjunta destacable en les darreres observacions disponibles.';

  return {
    key: 'marketSentiment',
    label,
    level,
    score,
    maxScore: sufficient ? availableComponents.length * 2 : null,
    availableComponents: availableComponents.length,
    totalComponents: components.length,
    reason,
    methodology: 'Índex propi del dashboard: VIX, tendència S&P 500/Nasdaq, OAS high yield i GPR. No és un índex oficial ni una predicció estadística.',
    latestDate: components.map(item => item.date).filter(Boolean).sort().pop() || null,
    components
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

function trendSignal(item, horizon, threshold, badWhen = 'up', usePct = false) {
  const field = horizon === '6m' ? (usePct ? 'change6mPct' : 'change6m') : (usePct ? 'change3mPct' : 'change3m');
  const value = item?.[field];
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const magnitude = Math.abs(Number(value));
  if (magnitude < threshold) return 0;
  const bad = badWhen === 'up' ? Number(value) > 0 : Number(value) < 0;
  return bad ? (magnitude >= threshold * 2 ? 2 : 1) : -1;
}

function seriesEvidence(key, item) {
  if (!item?.current) return null;
  const formatter = value => value === null || value === undefined || !Number.isFinite(Number(value))
    ? 'n/d'
    : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}`;
  const suffix = item.unit === '%' ? ' pp' : item.unit === 'punts percentuals' ? ' pp' : '';
  return {
    key,
    label: item.label,
    current: item.current.value,
    date: item.current.date,
    threeMonths: `${formatter(item.change3m)}${suffix}`,
    sixMonths: `${formatter(item.change6m)}${suffix}`
  };
}

function outlookState(score) {
  if (score >= 2) return { direction: 'negative', label: 'Deteriorament probable' };
  if (score >= 1) return { direction: 'caution', label: 'Vigilància' };
  if (score <= -1) return { direction: 'supportive', label: 'Millora / suport' };
  return { direction: 'stable', label: 'Estable o mixt' };
}

function outlookSentence(state, subject, horizon) {
  const prefix = horizon === 'short' ? 'Curt termini (1–3 mesos)' : 'Mitjà termini (3–6 mesos)';
  if (state.direction === 'negative') return `${prefix}: la pressió sobre ${subject} pot persistir o intensificar-se si no apareix una reversió clara.`;
  if (state.direction === 'caution') return `${prefix}: hi ha una tendència que requereix confirmació; encara no és un escenari prou sòlid per actuar per si sol.`;
  if (state.direction === 'supportive') return `${prefix}: ${subject} mostra una millora recent que podria donar suport als actius de risc si es manté.`;
  return `${prefix}: els senyals de ${subject} són estables o contradictoris; no hi ha una direcció prou clara.`;
}

function makeOutlook({ subject, score3m, score6m, available3m, available6m, evidence, watch }) {
  const available = Math.max(available3m, available6m);
  if (!available) {
    return {
      direction: 'unknown', label: 'Sense dades suficients', confidence: 'baixa',
      shortTerm: 'Curt termini (1–3 mesos): no es pot estimar la tendència amb les observacions disponibles.',
      mediumTerm: 'Mitjà termini (3–6 mesos): no es pot estimar la tendència amb les observacions disponibles.',
      evidence: evidence.filter(Boolean), watch
    };
  }
  const shortState = outlookState(score3m);
  const mediumState = outlookState(score6m);
  const confidence = available >= 3 ? 'alta' : available >= 2 ? 'mitjana' : 'baixa';
  return {
    direction: shortState.direction === 'negative' || mediumState.direction === 'negative' ? 'negative'
      : shortState.direction === 'caution' || mediumState.direction === 'caution' ? 'caution'
        : shortState.direction === 'supportive' && mediumState.direction === 'supportive' ? 'supportive' : 'stable',
    label: shortState.label === mediumState.label ? shortState.label : 'Mixt entre horitzons',
    confidence,
    shortTerm: outlookSentence(shortState, subject, 'short'),
    mediumTerm: outlookSentence(mediumState, subject, 'medium'),
    shortLabel: shortState.label,
    mediumLabel: mediumState.label,
    evidence: evidence.filter(Boolean),
    watch
  };
}

function buildMacroOutlook(series, blocks, marketSentiment) {
  const s = Object.fromEntries(series.map(item => [item.key, item]));
  const item = key => s[key];
  const base = key => blocks[key]?.level === 'alert' ? 1 : blocks[key]?.level === 'watch' ? 0.5 : 0;
  const make = (key, subject, signals, watch) => {
    const usable = signals.filter(signal => signal !== null);
    const score3m = base(key) + usable.reduce((sum, signal) => sum + (signal?.threeMonths || 0), 0);
    const score6m = base(key) + usable.reduce((sum, signal) => sum + (signal?.sixMonths || 0), 0);
    return [key, makeOutlook({
      subject, score3m, score6m,
      available3m: signals.filter(signal => signal?.threeMonths !== null && signal?.threeMonths !== undefined).length,
      available6m: signals.filter(signal => signal?.sixMonths !== null && signal?.sixMonths !== undefined).length,
      evidence: signals.flatMap(signal => signal?.evidence || []), watch
    })];
  };
  const signal = (key, threshold, badWhen, usePct = false) => {
    const data = item(key);
    return data ? {
      threeMonths: trendSignal(data, '3m', threshold, badWhen, usePct),
      sixMonths: trendSignal(data, '6m', threshold, badWhen, usePct),
      evidence: [seriesEvidence(key, data)]
    } : null;
  };

  const spreadNow = item('sofr')?.current && item('effr')?.current ? item('sofr').current.value - item('effr').current.value : null;
  const spread = spreadNow === null ? null : {
    current: { value: spreadNow, date: [item('sofr').current.date, item('effr').current.date].sort().pop() },
    change3m: (item('sofr').change3m || 0) - (item('effr').change3m || 0),
    change6m: (item('sofr').change6m || 0) - (item('effr').change6m || 0),
    unit: 'punts percentuals', label: 'Diferencial SOFR−EFFR'
  };
  const spreadSignal = spread ? {
    threeMonths: trendSignal(spread, '3m', 0.05, 'up'), sixMonths: trendSignal(spread, '6m', 0.05, 'up'), evidence: [seriesEvidence('sofrEffr', spread)]
  } : null;

  const outlookEntries = [
    make('credit', 'spreads i l’accés al crèdit', [signal('hyOas', 0.25, 'up'), signal('nfciCredit', 0.12, 'up')], 'Vigila si l’OAS high yield i el NFCI crèdit s’obren durant diverses observacions.'),
    make('financial', 'condicions de finançament', [signal('nfci', 0.10, 'up')], 'Vigila una pujada del NFCI cap a zero o per sobre, especialment si coincideix amb crèdit més car.'),
    make('curve', 'senyal de la corba de tipus', [signal('curve', 0.25, 'up')], 'Vigila si el re-steepening coincideix amb pitjor ocupació, activitat o crèdit.'),
    make('earnings', 'beneficis corporatius', [signal('profits', 3, 'down', true)], 'Vigila una caiguda de beneficis que es mantingui en la següent dada trimestral.'),
    make('activity', 'activitat i logística', [signal('claims', 5, 'up', true), signal('freight', 3, 'down', true), signal('starts', 6, 'down', true), signal('sentiment', 3, 'down', false)], 'Vigila confirmació conjunta entre transport, habitatge, atur i confiança.'),
    make('consumerStress', 'estrès del consumidor', [signal('revolving', 3, 'up', true), signal('delinq', 0.10, 'up')], 'Vigila que el revolving i la morositat pugin alhora; un sol dels dos no és suficient.'),
    make('interbank', 'liquiditat overnight', [spreadSignal], 'Vigila un salt persistent del diferencial SOFR−EFFR, no només una dada d’un dia.'),
    make('liquidity', 'liquiditat disponible als mercats', [signal('liquidityNet', 100, 'down')], 'Vigila una contracció de liquiditat neta que coincideixi amb spreads o VIX més alts.'),
    make('market', 'confirmació de la borsa', [signal('sp500', 3, 'down', true), signal('nasdaq', 3, 'down', true), signal('vix', 3, 'up', true)], 'Vigila una borsa feble amb VIX creixent i pèrdua de lideratge del Nasdaq.'),
    make('geopolitical', 'prima de risc geopolític', [signal('gpr', 25, 'up')], 'Vigila si el GPR continua pujant i es trasllada a VIX, crèdit, energia o logística.')
  ];

  const sentimentSignals = [signal('vix', 3, 'up', true), signal('sp500', 3, 'down', true), signal('hyOas', 0.25, 'up'), signal('gpr', 25, 'up')].filter(Boolean);
  const sentimentBase = marketSentiment?.level === 'alert' ? 1 : marketSentiment?.level === 'watch' ? 0.5 : 0;
  const sentiment3m = sentimentBase + sentimentSignals.reduce((sum, signal) => sum + (signal.threeMonths || 0), 0);
  const sentiment6m = sentimentBase + sentimentSignals.reduce((sum, signal) => sum + (signal.sixMonths || 0), 0);
  outlookEntries.push(['marketSentiment', makeOutlook({
    subject: 'sentiment agregat de mercat', score3m: sentiment3m, score6m: sentiment6m,
    available3m: sentimentSignals.filter(signal => signal.threeMonths !== null && signal.threeMonths !== undefined).length,
    available6m: sentimentSignals.filter(signal => signal.sixMonths !== null && signal.sixMonths !== undefined).length,
    evidence: sentimentSignals.flatMap(signal => signal.evidence || []),
    watch: 'Vigila si la prudència del GPR es converteix també en VIX alt, spreads més amplis i borsa feble.'
  })]);
  return Object.fromEntries(outlookEntries);
}

async function loadMacro({ force = false } = {}) {
  if (!force && cache.payload && Date.now() - cache.fetchedAt < CACHE_MS) return cache.payload;
  const retrieval = {};
  const entries = await limitedMap(Object.entries(SERIES), 5, async ([key, meta]) => {
    try {
      if (key === 'gpr') {
        retrieval[key] = 'Caldara–Iacoviello';
        return [key, await downloadGpr()];
      }
      const result = await download(meta.id);
      retrieval[key] = result.via;
      return [key, result.values];
    }
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
  assessment.marketSentiment = buildMarketSentiment(series);
  assessment.outlook = buildMacroOutlook(series, assessment.blocks, assessment.marketSentiment);
  assessment.marketSentiment.outlook = assessment.outlook.marketSentiment;
  const payload = { fetchedAt: new Date().toISOString(), series, assessment, errors, retrieval,
    sources: [...new Set(series.map(x => ({ name: x.source, url: x.url })).map(x => JSON.stringify(x)))].map(x => JSON.parse(x)) };
  cache = { fetchedAt: Date.now(), payload };
  return payload;
}

module.exports = { loadMacro, SERIES, buildMarketSentiment, buildMacroOutlook };
