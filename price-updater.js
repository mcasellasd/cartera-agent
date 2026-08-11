// price-updater.js — Agent d'actualització de preus diaris.
//
// Fonts:
//   - ETFs:  Google Finance  →  https://www.google.com/finance/quote/TICKER:EXCHANGE
//            Extreu el preu del bloc AF_initDataCallback({key: 'ds:1'...})
//   - Fons:  Finect          →  https://www.finect.com/fondos-inversion/ISIN-slug
//            Extreu el preu del JSON-LD <script type="application/ld+json">
//
// Actualitza ÚNICAMENT els camps `price`, `priceEur` i `date` del market_cache.json.
// Tots els altres camps (notes, escenaris, exposicions, etc.) es preserven intactes.
//
// Ús com a script autònom:  node price-updater.js
// Ús com a mòdul:           const { actualitzaPreus } = require('./price-updater');

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { loadMarketCache, saveMarketCache } = require('./market-store');

// ---------------------------------------------------------------------------
// Mapa de fonts per a cada ticker intern
// ---------------------------------------------------------------------------

// ETFs — format: { source: 'google', symbol: 'TICKER:EXCHANGE', cur: '€'|'$' }
// Fons — format: { source: 'finect', isin: 'ISIN', slug: 'text-slug' }
const PRICE_SOURCES = {
  // ── ETFs ──────────────────────────────────────────────────────────────────
  'IUES':   { source: 'google', symbol: 'IUES:ETR',    cur: '€' },   // Xetra
  'CNDX':   { source: 'google', symbol: 'CNX1:ETR',    cur: '€' },   // Xetra (cotitza com CNX1)
  'XAID':   { source: 'google', symbol: 'XAIX:ETR',    cur: '€' },   // Xetra (cotitza com XAIX)
  'XMME':   { source: 'google', symbol: 'XMME:ETR',    cur: '€' },   // Xetra
  'CSEMUS': { source: 'google', symbol: 'CSEMUS:ETR',  cur: '€' },   // Xetra
  'EUDI':   { source: 'google', symbol: 'EUDI:ETR',    cur: '€' },   // Xetra
  'DEFS':   { source: 'google', symbol: 'DEFS:EPA',    cur: '€' },   // Euronext Paris
  'BRIJ':   { source: 'google', symbol: 'BRIJ:NASDAQ', cur: '$' },   // NASDAQ (USD)
  'INFR':   { source: 'google', symbol: 'IDGB:LON',    cur: '€' },   // LSE (cotitza en GBX → convertim)
  'XDW0':   { source: 'google', symbol: 'XDW0:ETR',    cur: '$' },   // Xetra (USD)
  'BLKC':   { source: 'google', symbol: 'BLKC:AMS',    cur: '$' },   // Euronext Amsterdam (USD)
  // ── Fons ──────────────────────────────────────────────────────────────────────
  'VG GLOBAL': {
    source: 'finect',
    isin:  'IE00B03HCZ61',
    slug:  'Vanguard_global_stock_index_inv_eur_acc'          // canonique verificat
  },
  'VG EM': {
    source: 'finect',
    isin:  'IE0031786142',
    slug:  'Vanguard_emerg_mkts_stk_idx_inv_eur_acc'          // canonique verificat
  },
  'VG SMALL': {
    source: 'finect',
    isin:  'IE00B42LF923',
    slug:  'Vanguard_global_smallcap_idx_usd_acc'             // canonique verificat
  },
  'POLAR HC': {
    source: 'finect',
    isin:  'IE00B3K83P04',
    slug:  'Polar_Capital_Funds_Plc_Polar_Capital_Healthcare_Opportunities_Fund' // verificat via cerca
  },
  'CREAND RF': {
    source: 'finect',
    isin:  'ES0174013021',
    slug:  'Creand_renta_fija_mixta_r_fi'                     // canonique verificat
  },
};

// Paràmetres de xarxa
const TIMEOUT_MS    = 12000;
const DELAY_BETWEEN = 500; // ms entre crides

// ---------------------------------------------------------------------------
// Utilitats de xarxa
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ca,es;q=0.9,en;q=0.8',
      },
      timeout: TIMEOUT_MS,
    };
    const req = https.get(url, options, res => {
      // Seguim redireccions (301/302)
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume();
        const loc = res.headers.location;
        if (!loc) return reject(new Error('Redirect sense Location'));
        const absolute = loc.startsWith('http') ? loc : `https://www.google.com${loc}`;
        return fetchText(absolute).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Extracció de preus: Google Finance
// ---------------------------------------------------------------------------

/**
 * Extreu el preu des de la pàgina Google Finance.
 * Google embeu les dades en: AF_initDataCallback({key: 'ds:1', ...data:[[[...]])
 * El primer element de data[0][0] és l'array de metadades que inclou el preu.
 *
 * Retorna { price: number, currency: string } o null.
 */
async function fetchGoogleFinancePrice(symbol) {
  try {
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}`;
    const html = await fetchText(url);

    // Intentem extreure el bloc ds:1 que conté les dades del producte
    // Patró: AF_initDataCallback({key: 'ds:1', hash: '...', data:[[[name, ...price...]]]
    const ds1Match = html.match(/AF_initDataCallback\(\{key: 'ds:1'.*?data:(\[\[\[.*?\]\]\])/s);
    if (ds1Match) {
      try {
        const data = JSON.parse(ds1Match[1]);
        // Structure: [[[name, null, null, null, null, null, null, null, lastPrice, ...]]]
        // Index 8 = regularMarketPrice (last trade price)
        const row = data?.[0]?.[0];
        if (Array.isArray(row) && typeof row[8] === 'number' && row[8] > 0) {
          const currency = typeof row[15] === 'string' ? row[15] : 'EUR';
          return { price: row[8], currency };
        }
      } catch (_) { /* fallback */ }
    }

    // Fallback: cerca el preu en el JSON de dades de la cotització principal
    // Pattern en resposta: "regularMarketPrice":153.08 o similar
    const priceMatch = html.match(/"regularMarketPrice":\s*([\d.]+)/);
    if (priceMatch) {
      const curMatch = html.match(/"currency":\s*"([A-Z]{3})"/);
      return {
        price: parseFloat(priceMatch[1]),
        currency: curMatch ? curMatch[1] : 'EUR'
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extracció de preus: Finect (JSON-LD)
// ---------------------------------------------------------------------------

/**
 * Extreu el preu des de la pàgina Finect via el JSON-LD embedded.
 * Finect inclou: <script type="application/ld+json">{"offers":{"price":"61.35",...}}</script>
 *
 * Retorna { price: number, currency: string } o null.
 */
async function fetchFinectPrice(isin, slug) {
  try {
    // Primer provem amb la URL canònica (ISIN + slug exacte)
    const url = `https://www.finect.com/fondos-inversion/${isin}-${slug}`;
    const html = await fetchText(url);

    // El JSON-LD conté: "offers":{"@type":"Offer","price":"61.35","priceCurrency":"EUR",...}
    const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      try {
        const ld = JSON.parse(ldMatch[1]);
        const price = parseFloat(ld?.offers?.price);
        const currency = ld?.offers?.priceCurrency || 'EUR';
        if (price > 0) return { price, currency };
      } catch (_) { /* fallback */ }
    }

    // Fallback: cerca "price":"XX.XX" en qualsevol context del HTML
    const priceMatch = html.match(/"price":"([\d.]+)"/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price > 0) return { price, currency: 'EUR' };
    }

    return null;
  } catch (_) {
    return null;
  }
}

// Fallback: cerca per ISIN sense slug concret
async function fetchFinectPriceByIsin(isin) {
  try {
    const url = `https://www.finect.com/fondos-inversion/${isin}`;
    const html = await fetchText(url);
    const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      const ld = JSON.parse(ldMatch[1]);
      const price = parseFloat(ld?.offers?.price);
      const currency = ld?.offers?.priceCurrency || 'EUR';
      if (price > 0) return { price, currency };
    }
    return null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tipus de canvi EUR/USD via Google Finance
// ---------------------------------------------------------------------------

async function fetchEurUsd() {
  try {
    const html = await fetchText('https://www.google.com/finance/quote/EUR-USD');
    // El preu EUR/USD es troba en el bloc ds:1 o en el text de la pàgina
    const ds1Match = html.match(/AF_initDataCallback\(\{key: 'ds:1'.*?data:(\[\[\[.*?\]\]\])/s);
    if (ds1Match) {
      const data = JSON.parse(ds1Match[1]);
      const row = data?.[0]?.[0];
      if (Array.isArray(row) && typeof row[8] === 'number' && row[8] > 0.5) {
        console.log(`  [FX] EUR/USD = ${row[8]}`);
        return row[8];
      }
    }
    // Fallback: cerca el valor numèric de la pàgina
    const match = html.match(/EUR.*?USD.*?(1\.\d{3,6})/s);
    if (match) {
      const rate = parseFloat(match[1]);
      if (rate > 0.5 && rate < 3) {
        console.log(`  [FX] EUR/USD = ${rate} (fallback regex)`);
        return rate;
      }
    }
  } catch (_) {}
  console.warn('  [FX] No s\'ha pogut obtenir EUR/USD; s\'usa 1.13 com a fallback');
  return 1.13;
}

// ---------------------------------------------------------------------------
// Funció principal exportada
// ---------------------------------------------------------------------------

async function actualitzaPreus() {
  const t0 = Date.now();

  const portfolioPath = path.join(__dirname, 'data', 'portfolio.json');

  const marketState = await loadMarketCache();
  const cache     = marketState.cache;
  const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

  const tickersCartera = portfolio.posicions.map(p => p.ticker);
  const avui = new Date().toISOString().split('T')[0];

  // Tipus de canvi EUR/USD (necessari per actius en dòlars)
  console.log('[Preus] Obtenint tipus de canvi EUR/USD…');
  const eurUsd = await fetchEurUsd();
  await sleep(DELAY_BETWEEN);

  const updated = [];
  const failed  = [];

  for (const ticker of tickersCartera) {
    if (!cache[ticker]) {
      console.warn(`  [SKIP] ${ticker} no existeix al market_cache.json`);
      failed.push({ ticker, reason: 'no al cache' });
      continue;
    }

    const src = PRICE_SOURCES[ticker];
    if (!src) {
      console.warn(`  [SKIP] ${ticker} no té font de preu configurada`);
      failed.push({ ticker, reason: 'sense configuració de font' });
      continue;
    }

    let quote = null;

    if (src.source === 'google') {
      process.stdout.write(`  [GFin] ${ticker} (${src.symbol})… `);
      quote = await fetchGoogleFinancePrice(src.symbol);
      await sleep(DELAY_BETWEEN);
    } else if (src.source === 'finect') {
      process.stdout.write(`  [Finect] ${ticker} (${src.isin})… `);
      quote = await fetchFinectPrice(src.isin, src.slug);
      if (!quote) {
        await sleep(DELAY_BETWEEN);
        quote = await fetchFinectPriceByIsin(src.isin);
      }
      await sleep(DELAY_BETWEEN);
    }

    if (!quote || !quote.price || quote.price <= 0) {
      process.stdout.write('—\n');
      console.error(`  [ERROR] ${ticker}: no s'ha pogut obtenir el preu`);
      failed.push({ ticker, reason: `font ${src.source} no ha retornat preu vàlid` });
      continue;
    }

    process.stdout.write(`OK → ${quote.price} ${quote.currency}\n`);

    const prevPrice = cache[ticker].price;
    cache[ticker].price = Math.round(quote.price * 100) / 100;
    cache[ticker].date  = avui;

    // Conversió a EUR per actius en dòlars
    if (quote.currency === 'USD' || src.cur === '$') {
      cache[ticker].cur      = '$';
      cache[ticker].priceEur = Math.round((quote.price / eurUsd) * 100) / 100;
    } else if (quote.currency === 'GBX') {
      // Pence esterlins → euros (GBX/100 → GBP → EUR)
      const gbpUsd = 1.27; // aproximació; podríem obtenir-lo de Google Finance també
      cache[ticker].cur  = '€';
      cache[ticker].price = Math.round((quote.price / 100 / gbpUsd * eurUsd) * 100) / 100;
      delete cache[ticker].priceEur;
    } else {
      cache[ticker].cur = '€';
      delete cache[ticker].priceEur;
    }

    const pct = prevPrice
      ? ((cache[ticker].price - prevPrice) / prevPrice * 100).toFixed(2) + '%'
      : 'n/d';
    console.log(`  ✓ ${ticker}: ${prevPrice} → ${cache[ticker].price} €${cache[ticker].priceEur ? ` (€${cache[ticker].priceEur})` : ''} (${pct})`);

    updated.push({
      ticker,
      price:    cache[ticker].price,
      priceEur: cache[ticker].priceEur ?? null,
      currency: quote.currency,
      change:   pct,
      source:   src.source,
    });
  }

  // Persistència: Blob privat a Vercel; fitxer atòmic amb backup en local.
  const saved = await saveMarketCache(cache, { etag: marketState.etag });
  console.log(`\n[Preus] Cache guardat a ${saved.storage === 'blob' ? 'Vercel Blob' : 'disc local'}.`);

  const duration_ms = Date.now() - t0;
  console.log(`[Preus] Completat en ${duration_ms}ms — ${updated.length} actualitzats, ${failed.length} fallits\n`);

  return { updated, failed, eurUsd, duration_ms, storage: saved.storage };
}

// ---------------------------------------------------------------------------
// Mode CLI: node price-updater.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Agent d\'actualització de preus diaris          ║');
  console.log('║   ETFs: Google Finance · Fons: Finect            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  actualitzaPreus()
    .then(({ updated, failed, eurUsd, duration_ms }) => {
      console.log('┌─ Resum ─────────────────────────────────────────────┐');
      if (updated.length > 0) {
        console.log('│ ✅ Actualitzats:');
        updated.forEach(u => {
          const preuStr = u.priceEur != null
            ? `${u.price} USD → €${u.priceEur}`
            : `€${u.price}`;
          console.log(`│    ${u.ticker.padEnd(12)} ${preuStr.padEnd(26)} ${u.change}`);
        });
      }
      if (failed.length > 0) {
        console.log('│ ❌ Fallits:');
        failed.forEach(f => console.log(`│    ${f.ticker.padEnd(12)} ${f.reason}`));
      }
      console.log(`│ 💱 EUR/USD: ${eurUsd}   ⏱ Durada: ${duration_ms}ms`);
      console.log('└─────────────────────────────────────────────────────┘');
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('\n[FATAL]', err.message);
      process.exit(2);
    });
}

module.exports = { actualitzaPreus };
