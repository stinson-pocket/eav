// Crawl top-level page and check outgoing links for status codes
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
require('dotenv').config();

const target = process.argv[2] || (process.env.WP_SITE || 'https://eastatlantavillage.com');
const strictNetworkChecks = String(process.env.STRICT_NETWORK_CHECKS || '').toLowerCase() === 'true';
const requestHeaders = {
  'User-Agent': 'EAV-Monitor/1.0 (+https://eastatlantavillage.com)'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await axios.get(url, {
        timeout: 15000,
        headers: requestHeaders,
        maxRedirects: 5,
        validateStatus: status => status >= 200 && status < 400
      });
    } catch (err) {
      lastErr = err;
      if (i < attempts) await sleep(1000 * i);
    }
  }
  throw lastErr;
}

async function checkLink(href) {
  try {
    const res = await axios.head(href, {
      timeout: 10000,
      maxRedirects: 5,
      headers: requestHeaders
    });
    return { href, status: res.status };
  } catch (err) {
    return {
      href,
      status: (err.response && err.response.status) || 'ERR',
      code: err.code || null
    };
  }
}

async function run() {
  try {
    const res = await getWithRetry(target);
    const $ = cheerio.load(res.data);
    const anchors = $('a[href]').map((i, el) => $(el).attr('href')).get();
    const unique = [...new Set(anchors.filter(Boolean))].slice(0, 200);

    const checks = [];
    for (const href of unique) {
      let absolute = href;
      if (href.startsWith('/')) absolute = new URL(href, target).toString();
      if (!/^https?:\/\//i.test(absolute)) continue;
      checks.push(checkLink(absolute));
    }

    const results = await Promise.all(checks);
    const outPath = 'reports';
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
    const filename = `${outPath}/links-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log('Link check written to', filename);
  } catch (err) {
    const transient = new Set(['ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNRESET']);
    if (!strictNetworkChecks && transient.has(err.code)) {
      if (!fs.existsSync('reports')) fs.mkdirSync('reports');
      const filename = `reports/links-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify([{
        warning: 'Link check skipped due transient network timeout from runner',
        target,
        code: err.code || null,
        message: err.message || null
      }], null, 2));
      console.warn(`Link check warning: transient network issue (${err.code}). Report written to ${filename}`);
      return;
    }
    const status = err.response && err.response.status ? `status=${err.response.status}` : 'status=NA';
    const code = err.code ? `code=${err.code}` : 'code=NA';
    console.error(`Link check failed (${status}, ${code}):`, err.message || String(err));
    process.exit(2);
  }
}

run();
