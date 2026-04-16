const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

function secret(name) {
  const value = process.env[name];
  if (!value) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

async function sendDiscord(message) {
  const url = secret('DISCORD_WEBHOOK_URL');
  if (!url) return;
  try {
    await axios.post(url, { content: message }, { timeout: 15000 });
    console.log('Discord alert sent');
  } catch (err) {
    console.warn('Discord alert failed:', err.response?.data?.message || err.message);
  }
}

async function sendTelegram(message) {
  const token = secret('TELEGRAM_BOT_TOKEN');
  const chatId = secret('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text: message }, { timeout: 15000 });
    console.log('Telegram alert sent');
  } catch (err) {
    console.warn('Telegram alert failed:', err.response?.data?.description || err.message);
  }
}

async function sendEmail(subject, message) {
  const to = secret('ADMIN_EMAIL');
  const host = secret('SMTP_HOST');
  if (!to || !host) return;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `eav-alerts <${to}>`,
      to,
      subject,
      text: message
    });
    console.log('Email alert sent to', to);
  } catch (err) {
    console.warn('Email alert failed:', err.message);
  }
}

async function main() {
  const title = process.env.ALERT_TITLE || 'Automation Alert';
  const body = process.env.ALERT_MESSAGE || 'Automation failure detected.';
  const message = `${title}\n${body}`;
  await sendDiscord(message);
  await sendTelegram(message);
  await sendEmail(title, message);
}

main().catch((err) => {
  console.error('Alert script failed:', err.message);
  process.exit(1);
});
