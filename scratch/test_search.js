const https = require('https');
const fs = require('fs');
const path = require('path');
const __dirname_real = '/Users/marccasellas/Library/Application Support/Claude/local-agent-mode-sessions/1a11733a-3528-4de2-b352-5444a385f10b/5e335d50-9da0-44ce-872a-73f853eca196/local_a69dcffd-0a5f-4cd7-ae1b-89903980ea41/outputs/cartera-agent';

function searchDuckDuckGo(query) {
  return new Promise((resolve, reject) => {
    // DuckDuckGo HTML search URL
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(path.join(__dirname_real, 'scratch', 'duck.html'), data, 'utf8');
        console.log("Saved duck.html");
        const results = [];
        
        // Regex for links/titles
        const titleRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        // Regex for snippets
        const snippetRegex = /<a class="result__snippet" href="[^"]+"[^>]*>([\s\S]*?)<\/a>/g;
        
        let match;
        while ((match = titleRegex.exec(data)) !== null) {
          const rawUrl = match[1];
          // DuckDuckGo proxy-redirects URLs sometimes like: //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com
          // Let's clean it up
          let cleanUrl = rawUrl;
          if (rawUrl.includes('uddg=')) {
            const part = rawUrl.split('uddg=')[1].split('&')[0];
            cleanUrl = decodeURIComponent(part);
          }
          results.push({
            url: cleanUrl,
            title: match[2].replace(/<[^>]+>/g, '').trim(),
            snippet: ''
          });
        }
        
        let snMatch;
        let idx = 0;
        while ((snMatch = snippetRegex.exec(data)) !== null && idx < results.length) {
          results[idx].snippet = snMatch[1].replace(/<[^>]+>/g, '').trim();
          idx++;
        }
        
        resolve(results.slice(0, 5));
      });
    });
    req.on('error', (e) => reject(e));
  });
}

searchDuckDuckGo('fons Creand')
  .then(res => {
    console.log('Results length:', res.length);
  })
  .catch(err => {
    console.error('Error:', err);
  });
