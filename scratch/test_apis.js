const https = require('https');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (e) => reject(e));
  });
}

// Test Qwant, Swisscows, Searx, DDG api, Yahoo
async function run() {
  console.log('Testing Yahoo Finance search...');
  try {
    const r = await testUrl('https://query1.finance.yahoo.com/v1/finance/search?q=Creand');
    console.log('Yahoo Finance status:', r.status);
    console.log('Yahoo Finance body preview:', r.body.slice(0, 300));
  } catch(e) { console.error('Yahoo error:', e.message); }

  console.log('\nTesting SearXNG mx instance...');
  try {
    const r = await testUrl('https://searx.mx/search?q=Creand+fons&format=json');
    console.log('SearXNG mx status:', r.status);
    const j = JSON.parse(r.body);
    console.log('SearXNG mx results:', j.results?.length);
    console.log('First result:', j.results?.[0]?.title, '->', j.results?.[0]?.url);
  } catch(e) { console.error('SearXNG mx error:', e.message); }

  console.log('\nTesting SearXNG priv.au instance...');
  try {
    const r = await testUrl('https://priv.au/search?q=Creand+fons&format=json');
    console.log('SearXNG priv.au status:', r.status);
    const j = JSON.parse(r.body);
    console.log('SearXNG priv.au results:', j.results?.length);
    console.log('First result:', j.results?.[0]?.title, '->', j.results?.[0]?.url);
  } catch(e) { console.error('SearXNG priv.au error:', e.message); }

  console.log('\nTesting DuckDuckGo Instant Answer API...');
  try {
    const r = await testUrl('https://api.duckduckgo.com/?q=Microsoft&format=json');
    console.log('DDG status:', r.status);
    console.log('DDG body preview:', r.body.slice(0, 300));
  } catch(e) { console.error('DDG error:', e.message); }
}

run();
