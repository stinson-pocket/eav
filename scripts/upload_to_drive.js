const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

async function main() {
  const keyJsonB64 = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!keyJsonB64 || !folderId) {
    console.log('GDrive service account JSON or folder ID not provided; skipping upload.');
    return;
  }

  const keyJson = JSON.parse(Buffer.from(keyJsonB64, 'base64').toString('utf8'));
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

main().catch(err => { console.error('Drive upload failed', err.message); process.exit(2); });
