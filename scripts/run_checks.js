// Runs all checks and produces a summary report. Exit non-zero if any check failed.
const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

function runCmd(cmd) {
  try {
    console.log('RUN:', cmd);
    execSync(cmd, { stdio: 'inherit' });
    return { ok: true };
  } catch (err) {
    console.error('Command failed:', cmd);
    return {
      ok: false,
      message: err.message,
      exitStatus: typeof err.status === 'number' ? err.status : null,
      signal: err.signal || null
    };
  }
}

const results = { startedAt: new Date().toISOString(), checks: {} };

results.checks.seo = runCmd('node scripts/seo_check.js');
results.checks.links = runCmd('node scripts/link_check.js');
results.checks.plagiarism = runCmd('node scripts/plagiarism_check.js');

results.completedAt = new Date().toISOString();

if (!fs.existsSync('reports')) fs.mkdirSync('reports');
fs.writeFileSync(`reports/summary-${Date.now()}.json`, JSON.stringify(results, null, 2));

const anyFailed = Object.values(results.checks).some(r => r && !r.ok);
if (anyFailed) process.exit(2);
console.log('All checks completed successfully.');
