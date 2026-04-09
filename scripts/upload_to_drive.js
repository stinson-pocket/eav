const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

function parseServiceAccountSecret(rawValue) {
  if (!rawValue) throw new Error('GDRIVE_SERVICE_ACCOUNT_JSON is empty.');
  const value = String(rawValue).trim().replace(/^['"]|['"]$/g, '');

  // Accept plain JSON first (common with `gh secret set ... < file.json`).
  try {
    return JSON.parse(value);
  } catch (_) {
    // Fall through and try base64.
  }

  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (_) {
    throw new Error(
      'GDRIVE_SERVICE_ACCOUNT_JSON is neither valid JSON nor base64-encoded JSON.'
    );
  }
}

async function main() {
  const rawServiceAccount = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GDRIVE_FOLDER_ID ? process.env.GDRIVE_FOLDER_ID.trim() : '';
  if (!rawServiceAccount || !folderId) {
    console.log('GDrive service account JSON or folder ID not provided; skipping upload.');
    return;
  }

  const keyJson = parseServiceAccountSecret(rawServiceAccount);
  if (typeof keyJson.private_key === 'string') {
    keyJson.private_key = keyJson.private_key.replace(/\\n/g, '\n');
  }

  const jwtClient = new google.auth.JWT(
    keyJson.client_email,
    null,
    keyJson.private_key,
    ['https://www.googleapis.com/auth/drive.file']
  );

  await jwtClient.authorize();
  const drive = google.drive({ version: 'v3', auth: jwtClient });

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    console.log('No reports directory; nothing to upload.');
    return;
  }

  const files = fs.readdirSync(reportsDir).filter(f => f && !f.startsWith('.'));
  for (const f of files) {
    const filePath = path.join(reportsDir, f);
    const metadata = await drive.files.create({
      requestBody: { name: f, parents: [folderId] },
      media: { body: fs.createReadStream(filePath) }
    });
    console.log('Uploaded', f, '->', metadata.data.id);
  }
}

main().catch(err => {
  console.error('Drive upload failed', err.message);
  console.error(
    'Hint: set GDRIVE_SERVICE_ACCOUNT_JSON to the full JSON key (or base64 JSON), and share the target Drive folder with the service account email.'
  );
  process.exit(2);
});
