Monitoring & QA automation for EastAtlantaVillage

Overview
- Scripts to run automated SEO checks, link checks, and a placeholder plagiarism check.
- A rollback helper to unpublish problematic posts via the WordPress REST API.
- A GitHub Actions workflow to run checks on a schedule and notify via Slack or create issues.

Setup
1. Copy `.env.example` to `.env` and fill values (WP site, credentials, Slack webhook, plagiarism API key).
2. From the `eav-automation` folder run `npm install`.
3. Locally run `npm run check:all` to generate `reports/report-<timestamp>.json`.

Deployment
- Push this repo to GitHub and enable the workflow in `.github/workflows/monitor.yml`.

Notes
- Plagiarism check script is a placeholder requiring a real API key and adjust endpoints.
- Read the scripts before running to confirm they match your WP setup and security policies.
- Notifications: this project supports Discord webhooks, Telegram bot messages, and email (see `.env.example`). Slack is no longer used.
- Google Drive: to automatically copy reports into a Drive folder, create a Google Service Account, grant it access to the target folder, and add the service-account JSON (base64-encoded) as `GDRIVE_SERVICE_ACCOUNT_JSON` and the folder ID as `GDRIVE_FOLDER_ID` in GitHub Secrets. The workflow will call `scripts/upload_to_drive.js` when secrets are present.

WordPress Publishing Recovery
- EAV news must be published in WordPress first for SEO/canonical continuity.
- GitHub secrets are write-only; `WP_APP_PASSWORD` cannot be read back after it is set.
- As of May 18, 2026, the stored REST app password authenticates but cannot create posts (`rest_cannot_create`). Rotate it before relying on REST publishing.
- WP-CLI fallback is confirmed on Hostinger:
  - SSH key: `$HOME/.ssh/hostinger_pickwinningnumbers`
  - Host/user/port: `u514430741@109.106.250.190:65002`
  - Web root: `domains/eastatlantavillage.com/public_html`
  - Server command: `wp`
- After WP-CLI publishing, run the local migration/build/deploy flow so homepage data, generated article copy, and `/sitemap.xml` reflect the WordPress story.
- Never store plaintext WordPress passwords or application passwords in docs or repo files.
