// Basic SEO checks: title, meta description, H1 presence, word count
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
require('dotenv').config();

const target = process.argv[2] || (process.env.WP_SITE || 'https://eastatlantavillage.com');

async function run() {
  try {
    const url = target;
    const res = await axios.get(url, { timeout: 15000 });
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
    console.error('SEO check failed:', err.message);
    process.exit(2);
  }
}

run();
