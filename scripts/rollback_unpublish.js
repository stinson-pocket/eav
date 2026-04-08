// Rollback helper: unpublish a post by ID (set status to 'draft') or unpublish recent posts matching a tag
const axios = require('axios');
require('dotenv').config();

const WP_SITE = process.env.WP_SITE;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!WP_SITE || !WP_USER || !WP_APP_PASSWORD) {
  console.error('Set WP_SITE, WP_USER, and WP_APP_PASSWORD in environment.');
  process.exit(2);
}

const auth = { username: WP_USER, password: WP_APP_PASSWORD };

async function unpublishPostById(id) {
  try {
    const url = `${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/posts/${id}`;
    const res = await axios.post(url, { status: 'draft' }, { auth });
    console.log('Unpublished post', id, '->', res.data.link || res.data.status);
  } catch (err) {
    console.error('Failed to unpublish', id, err.message);
  }
}

async function unpublishByTagSlug(tagSlug) {
  try {
    const tagRes = await axios.get(`${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/tags?slug=${tagSlug}`, { auth });
    if (!tagRes.data || !tagRes.data.length) {
      console.log('No tag found for', tagSlug);
      return;
    }
    const tagId = tagRes.data[0].id;
    const postsRes = await axios.get(`${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/posts?tags=${tagId}&per_page=20`, { auth });
    const posts = postsRes.data || [];
    for (const p of posts) {
      console.log('Unpublishing post', p.id, p.title && p.title.rendered);
      await axios.post(`${WP_SITE.replace(/\/$/, '')}/wp-json/wp/v2/posts/${p.id}`, { status: 'draft' }, { auth });
    }
  } catch (err) {
    console.error('Failed unpublishByTag', err.message);
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node rollback_unpublish.js <postId|tag:slug>');
  process.exit(2);
}

(async function () {
  if (arg.indexOf('tag:') === 0) {
    const slug = arg.split(':')[1];
    await unpublishByTagSlug(slug);
  } else {
    await unpublishPostById(arg);
  }
})();
