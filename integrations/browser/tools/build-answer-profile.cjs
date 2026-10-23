#!/usr/bin/env node
'use strict';
// Deterministic data build only: no model, network, environment key or account access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const CORE = 'evaluations/instruction-1.3.6/core.en.txt';
const SUPPLEMENT = 'evaluations/answer-pilot/supplement.en.txt';
const DESTINATION = 'integrations/browser/server/instruction-candidate.json';
const CORE_SHA256 = '408caf2a728d961985886c0f4499400dcbffdf91411b7c97722694db9c80010e';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
function buildCandidate() {
  const coreBytes = fs.readFileSync(path.join(ROOT, CORE));
  const supplementBytes = fs.readFileSync(path.join(ROOT, SUPPLEMENT));
  // Preserve BOMs, line endings and code points; reject malformed UTF-8.
  const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (sha256(coreBytes) !== CORE_SHA256) throw new Error('Candidate core changed; review the source binding explicitly');
  const core = decode(coreBytes), supplement = decode(supplementBytes);
  if (!supplement.trim()) throw new Error('Empty candidate supplement');
  return JSON.stringify({ schema: 1, profile: 'candidate-1.3.6', instructionVersion: '1.3.6',
    coreSource: CORE, coreSha256: sha256(coreBytes), core,
    supplementSource: SUPPLEMENT, supplementSha256: sha256(supplementBytes), supplement }, null, 2) + '\n';
}
function main() {
  if (process.argv.slice(2).some(arg => arg !== '--check') || process.argv.length > 3) throw new Error('Usage: build-answer-profile.cjs [--check]');
  const output = path.join(ROOT, DESTINATION), bytes = Buffer.from(buildCandidate(), 'utf8');
  if (process.argv.includes('--check')) {
    if (!fs.readFileSync(output).equals(bytes)) throw new Error('Candidate artifact differs from its sources');
    console.log('Candidate artifact matches sources; no model request or behavior score.');
  } else {
    fs.writeFileSync(output, bytes);
    console.log('Wrote ' + DESTINATION + '; no installation or model behavior claim.');
  }
}
if (require.main === module) main();
module.exports = { buildCandidate, CORE_SHA256 };
