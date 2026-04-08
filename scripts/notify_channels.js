const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

async function readLatestSummary() {
  const dir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(Boolean).map(f => ({f, t: fs.statSync(path.join(dir,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
  if (!files.length) return null;
  const latest = path.join(dir, files[0].f);
  return { path: latest, content: fs.readFileSync(latest, 'utf8') };
}

async function notifyDiscord(text) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(url, { content: text });
    console.log('Discord notified');
  } catch (err) {
    console.warn('Discord notify failed', err.message);
  }
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text });
    console.log('Telegram notified');
  } catch (err) {
    console.warn('Telegram notify failed', err.message);
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
