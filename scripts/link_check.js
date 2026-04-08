// Crawl top-level page and check outgoing links for status codes
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
require('dotenv').config();

const target = process.argv[2] || (process.env.WP_SITE || 'https://eastatlantavillage.com');

async function checkLink(href) {
  try {
    const res = await axios.head(href, { timeout: 10000, maxRedirects: 5 });
    return { href, status: res.status };
  } catch (err) {
    return { href, status: (err.response && err.response.status) || 'ERR' };
  }
}

async function run() {
  try {
    const res = await axios.get(target, { timeout: 15000 });
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
    console.error('Link check failed:', err.message);
    process.exit(2);
  }
}

run();
