const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = class EvidenceReporter {
  onBegin() {
    this.results = [];
    this.sources = Object.fromEntries(['web/worker.mjs', 'web/atomvm-worker.mjs', 'web/popcorn-adapter.mjs', 'web/app.mjs', 'web/index.html', 'tests/browser.spec.cjs', 'tests/evidence-reporter.cjs', 'playwright.config.cjs', 'serve.py'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', name))).digest('hex')]));
  }
  onTestEnd(test, result) {
    const evidence = result.attachments.find(attachment => attachment.name === 'runtime-evidence');
    const project = result.attachments.find(attachment => attachment.name === 'project-evidence');
    this.results.push({ name: test.title, status: result.status, durationMs: result.duration, errors: result.errors.map(error => error.message), evidence: evidence?.body ? JSON.parse(evidence.body.toString()) : null, project: project?.body ? JSON.parse(project.body.toString()) : null });
  }
  onEnd(result) {
    const directory = path.join(__dirname, '../evidence');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'browser.json'), JSON.stringify({ schemaVersion: 1, time: new Date().toISOString(), status: result.status, scope: 'Chromium browser execution with external HTTP requests blocked', labSourceHashes: this.sources, results: this.results }, null, 2) + '\n');
  }
};
