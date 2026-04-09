const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

function readSecret(name) {
  const value = process.env[name];
  if (!value) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

async function readLatestSummary() {
  const dir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(Boolean).map(f => ({f, t: fs.statSync(path.join(dir,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
  if (!files.length) return null;
  const latest = path.join(dir, files[0].f);
  return { path: latest, content: fs.readFileSync(latest, 'utf8') };
}

async function notifyDiscord(text) {
  const url = readSecret('DISCORD_WEBHOOK_URL');
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (!/^discord(?:app)?\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) {
      throw new Error('DISCORD_WEBHOOK_URL does not look like a Discord webhook URL');
    }
    await axios.post(url, { content: text }, { timeout: 15000 });
    console.log('Discord notified');
  } catch (err) {
    console.warn('Discord notify failed', err.response?.data?.message || err.message);
  }
}

async function notifyTelegram(text) {
  const token = readSecret('TELEGRAM_BOT_TOKEN');
  const chatId = readSecret('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return;
  try {
    await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 15000 });
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text }, { timeout: 15000 });
    console.log('Telegram notified');
  } catch (err) {
    const details = err.response?.data?.description || err.message;
    console.warn('Telegram notify failed', details);
  }
}

async function notifyEmail(subject, text) {
  const admin = process.env.ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  if (!admin) return;
  if (!smtpHost) {
    console.log('No SMTP configured; skipping email. You can configure SMTP_HOST, SMTP_USER, SMTP_PASS in env.');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    await transporter.sendMail({ from: process.env.SMTP_FROM || `eav-monitor <${admin}>`, to: admin, subject, text });
    console.log('Email sent to', admin);
  } catch (err) {
    console.warn('Email failed', err.message);
  }
}

(async function () {
  const summary = await readLatestSummary();
  const text = summary ? `Site QA report: ${summary.path}\n\n` + summary.content.slice(0, 4000) : 'Site QA report: no reports found.';
  await notifyDiscord(text);
  await notifyTelegram(text);
  await notifyEmail('EAV Site QA Report', text);
})();
