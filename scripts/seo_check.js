// Basic SEO checks: title, meta description, H1 presence, word count
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
require('dotenv').config();

const target = process.argv[2] || (process.env.WP_SITE || 'https://eastatlantavillage.com');
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

async function run() {
  try {
    const url = target;
    const res = await getWithRetry(url);
    const $ = cheerio.load(res.data);

    const title = $('head > title').text().trim();
    const metaDescription = $('head > meta[name="description"]').attr('content') || '';
    const h1 = $('h1').first().text().trim();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    const sentenceCount = (bodyText.match(/[.!?]+/g) || []).length || 1;
    const avgWordsPerSentence = wordCount / sentenceCount;

    const report = {
      url,
      title: title || null,
      metaDescription: metaDescription || null,
      hasH1: !!h1,
      h1: h1 || null,
      wordCount,
      avgWordsPerSentence
    };

    const outPath = 'reports';
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
    const filename = `${outPath}/seo-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log('SEO check written to', filename);
  } catch (err) {
    const status = err.response && err.response.status ? `status=${err.response.status}` : 'status=NA';
    const code = err.code ? `code=${err.code}` : 'code=NA';
    console.error(`SEO check failed (${status}, ${code}):`, err.message || String(err));
    process.exit(2);
  }
}

run();
