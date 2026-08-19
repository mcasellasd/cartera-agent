'use strict';

const fs = require('fs');
const path = require('path');
const { loadMacro } = require('../macro-store');

delete process.env.VERCEL;

loadMacro({ force: true })
  .then(payload => {
    if (!payload.series?.some(series => series.current)) {
      throw new Error('La captura no conté cap observació macro.');
    }
    const target = path.join(__dirname, '..', 'data', 'macro_cache.json');
    fs.writeFileSync(target, `${JSON.stringify(payload)}\n`);
    const available = payload.series.filter(series => series.current).length;
    console.log(`Captura macro guardada: ${available}/${payload.series.length} sèries amb observacions.`);
  })
  .catch(error => {
    console.error(`No s’ha pogut actualitzar la captura macro: ${error.message}`);
    process.exitCode = 1;
  });
