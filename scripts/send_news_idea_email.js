const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

function latestDraft() {
  const dir = path.join(__dirname, '..', 'reports', 'news-drafts');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) return null;
  const fullPath = path.join(dir, files[0].f);
  return {
    path: fullPath,
    content: fs.readFileSync(fullPath, 'utf8'),
  };
}

async function send() {
  const admin = String(process.env.ADMIN_EMAIL || '').trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  if (!admin) {
    console.log('ADMIN_EMAIL not configured; skipping weekly news email.');
    return;
  }
  if (!smtpHost) {
    console.log('SMTP_HOST not configured; skipping weekly news email.');
    return;
  }

  const draft = latestDraft();
  if (!draft) {
    console.log('No generated news draft found; skipping email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `eav-news-bot <${admin}>`,
    to: admin,
    subject: 'EAV Weekly News Draft (Wednesday)',
    text: `Weekly draft generated for review.\n\nFile: ${draft.path}\n\n${draft.content}`
  });

  console.log('Weekly news draft email sent to', admin);
}

send().catch((err) => {
  console.error('Weekly news draft email failed:', err.message);
  process.exit(1);
});
