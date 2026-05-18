#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const WP_SITE = process.env.WP_SITE;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!WP_SITE || !WP_USER || !WP_APP_PASSWORD) {
  console.error('Missing WP_SITE, WP_USER, or WP_APP_PASSWORD.');
  process.exit(1);
}

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('Usage: node scripts/publish_wp_story.js <story-payload.json>');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const base = WP_SITE.replace(/\/$/, '');
const auth = { username: WP_USER, password: WP_APP_PASSWORD };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireField(payload, name) {
  if (!payload[name]) {
    throw new Error(`Missing required payload field: ${name}`);
  }
}

function absolutize(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

async function uploadFeaturedImage(payload) {
  if (!payload.image) return null;

  const imagePath = absolutize(payload.image);
  const imageBuffer = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const createRes = await axios.post(`${base}/wp-json/wp/v2/media`, imageBuffer, {
    auth,
    timeout: 30000,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': mimeType,
    },
  });

  const mediaId = createRes.data && createRes.data.id;
  if (!mediaId) {
    throw new Error('WordPress media upload did not return an id.');
  }

  if (payload.image_alt || payload.image_caption) {
    await axios.post(`${base}/wp-json/wp/v2/media/${mediaId}`, {
      alt_text: payload.image_alt || '',
      caption: payload.image_caption || '',
    }, { auth, timeout: 30000 });
  }

  return mediaId;
}

async function main() {
  const payload = readJson(payloadPath);
  requireField(payload, 'title');
  requireField(payload, 'slug');
  requireField(payload, 'excerpt');

  const content = payload.content || fs.readFileSync(absolutize(payload.contentHtmlPath), 'utf8');
  const featuredMediaId = await uploadFeaturedImage(payload);

  const postBody = {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt,
    content,
    status: payload.status || 'publish',
  };

  if (featuredMediaId) postBody.featured_media = featuredMediaId;
  if (payload.categories) postBody.categories = payload.categories;
  if (payload.tags) postBody.tags = payload.tags;

  const postRes = await axios.post(`${base}/wp-json/wp/v2/posts`, postBody, {
    auth,
    timeout: 30000,
  });

  const link = postRes.data && postRes.data.link;
  if (!link) {
    throw new Error('WordPress post publish did not return a link.');
  }

  console.log(JSON.stringify({
    id: postRes.data.id,
    slug: postRes.data.slug,
    link,
    featured_media: featuredMediaId,
  }, null, 2));
}

main().catch((err) => {
  const status = err.response && err.response.status;
  const data = err.response && err.response.data;
  console.error(`Publish failed${status ? ` (${status})` : ''}: ${err.message}`);
  if (data) console.error(JSON.stringify(data, null, 2));
  process.exit(1);
});
