'use strict';
const crypto = require('node:crypto');
require('../extension/instructions.js');
const STABLE = 'stable';
const CANDIDATE = 'candidate-1.3.6';
const CORE_SHA256 = '408caf2a728d961985886c0f4499400dcbffdf91411b7c97722694db9c80010e';
const sha256 = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
function fail(code) { const error = new Error(code); error.code = code; error.status = 503; throw error; }
function validateCandidateArtifact(value) {
  const fields = ['schema', 'profile', 'instructionVersion', 'coreSource', 'coreSha256', 'core',
    'supplementSource', 'supplementSha256', 'supplement'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key)) ||
      value.schema !== 1 || value.profile !== CANDIDATE || value.instructionVersion !== '1.3.6' ||
      value.coreSource !== 'evaluations/instruction-1.3.6/core.en.txt' ||
      value.supplementSource !== 'evaluations/answer-pilot/supplement.en.txt' ||
      typeof value.core !== 'string' || typeof value.supplement !== 'string' || !value.supplement.trim() ||
      value.coreSha256 !== CORE_SHA256 || sha256(value.core) !== CORE_SHA256 ||
      !/^[0-9a-f]{64}$/u.test(value.supplementSha256 || '') || sha256(value.supplement) !== value.supplementSha256) {
    fail('ANSWER_PROFILE_UNAVAILABLE');
  }
  return Object.freeze({ ...value });
}
let candidate;
function resolveAnswerProfile(name = STABLE) {
  if (name === STABLE) {
    const source = globalThis.BeforewordInstructions;
    if (typeof source?.core !== 'string' || !source.core) fail('INSTRUCTIONS_UNAVAILABLE');
    return Object.freeze({ profile: STABLE, instructionVersion: source.version, core: source.core, supplement: '' });
  }
  if (name !== CANDIDATE) fail('INVALID_ANSWER_PROFILE_CONFIGURATION');
  if (!candidate) {
    try { candidate = validateCandidateArtifact(require('./instruction-candidate.json')); }
    catch { fail('ANSWER_PROFILE_UNAVAILABLE'); }
  }
  return candidate;
}
function answerProfileMetadata(name = STABLE) {
  const profile = resolveAnswerProfile(name);
  if (profile.profile === STABLE) return undefined; // Preserve the existing default response shape.
  return { id: profile.profile, instructionVersion: profile.instructionVersion,
    coreSha256: profile.coreSha256, supplementSha256: profile.supplementSha256, status: 'candidate' };
}
module.exports = { STABLE, CANDIDATE, resolveAnswerProfile, answerProfileMetadata, validateCandidateArtifact, sha256 };
