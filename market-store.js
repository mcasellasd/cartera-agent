'use strict';

const fs = require('fs');
const path = require('path');

const LOCAL_CACHE_PATH = path.join(__dirname, 'data', 'market_cache.json');
const BLOB_PATHNAME = 'cartera/market_cache.json';

function usesBlob() {
  // Connexions noves: OIDC de curta durada + BLOB_STORE_ID.
  // Connexions antigues: BLOB_READ_WRITE_TOKEN.
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL && process.env.BLOB_STORE_ID)
  );
}

async function blobSdk() {
  return import('@vercel/blob');
}

async function streamToText(stream) {
  if (!stream) throw new Error('El Blob de preus no conté dades');
  return new Response(stream).text();
}

async function loadMarketCache() {
  if (!usesBlob()) {
    return {
      cache: JSON.parse(fs.readFileSync(LOCAL_CACHE_PATH, 'utf8')),
      etag: null,
      storage: 'local'
    };
  }

  const { get, put } = await blobSdk();
  const result = await get(BLOB_PATHNAME, { access: 'private', useCache: false });

  if (result?.statusCode === 200) {
    return {
      cache: JSON.parse(await streamToText(result.stream)),
      etag: result.blob.etag,
      storage: 'blob'
    };
  }

  // Primera execució: el JSON inclòs al desplegament actua com a llavor.
  const seed = fs.readFileSync(LOCAL_CACHE_PATH, 'utf8');
  const created = await put(BLOB_PATHNAME, seed, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 60
  });

  return {
    cache: JSON.parse(seed),
    etag: created.etag,
    storage: 'blob'
  };
}

async function saveMarketCache(cache, { etag = null } = {}) {
  const body = JSON.stringify(cache, null, 2);

  if (!usesBlob()) {
    const backupPath = `${LOCAL_CACHE_PATH}.bak`;
    const temporaryPath = `${LOCAL_CACHE_PATH}.${process.pid}.tmp`;

    fs.copyFileSync(LOCAL_CACHE_PATH, backupPath);
    fs.writeFileSync(temporaryPath, body, 'utf8');
    fs.renameSync(temporaryPath, LOCAL_CACHE_PATH);

    return { storage: 'local', etag: null };
  }

  const { put } = await blobSdk();
  const saved = await put(BLOB_PATHNAME, body, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {})
  });

  return { storage: 'blob', etag: saved.etag };
}

module.exports = {
  BLOB_PATHNAME,
  loadMarketCache,
  saveMarketCache,
  usesBlob
};
