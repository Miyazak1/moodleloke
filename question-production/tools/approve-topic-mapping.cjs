#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function run() {
  const packDir = path.resolve(__dirname, '..', 'accepted', 'pilot-30-v4');
  const proposalFile = path.join(packDir, 'topic-mapping-proposal.json');
  const selectionFile = path.join(packDir, 'selection-plan.json');
  const proposalRaw = fs.readFileSync(proposalFile); const proposal = JSON.parse(proposalRaw); const selection = JSON.parse(fs.readFileSync(selectionFile, 'utf8'));
  const selectedIds = selection.candidates.map((entry) => entry.candidateId);
  if (proposal.status !== 'proposal_only_requires_supervisor_approval' || proposal.mappings.length !== 30 || proposal.summary?.proposed !== 30 || proposal.summary?.unmapped !== 0) throw new Error('supervisor approval scope requires exactly 30 proposed and 0 unmapped entries');
  if (JSON.stringify([...selectedIds].sort()) !== JSON.stringify(proposal.mappings.map((entry) => entry.candidateId).sort())) throw new Error('proposal candidates do not exactly match selection');
  if (proposal.mappings.some((entry) => entry.mappingStatus !== 'proposed' || !entry.mappedTopicCode || !Number.isInteger(entry.mappedTopicId) || !Number.isInteger(entry.specialPracticeTopicId) || !entry.specialPracticeTopicSlug)) throw new Error('proposal contains an unapproved or incomplete pair');
  const approvedAt = new Date().toISOString(); const proposalSha256 = sha256(proposalRaw); const scope = 'pilot-30-v4';
  const approved = {
    schemaVersion: 'codex-accepted-topic-mapping-v1',
    packId: proposal.packId,
    status: 'approved_by_supervisor',
    scope,
    approvedAt,
    proposalSha256,
    approvalStatement: 'Supervisor approved exactly the 30 proposal entries in the referenced digest; no unmapped or additional entry was promoted.',
    mappings: proposal.mappings.map((entry) => ({ candidateId: entry.candidateId, subject: entry.subject, originalTopicCode: entry.originalTopicCode, taskFamily: entry.taskFamily, mappingStatus: 'approved', mappedTopicCode: entry.mappedTopicCode, mappedTopicId: entry.mappedTopicId, mappedTopicTitle: entry.mappedTopicTitle, specialPracticeTopicId: entry.specialPracticeTopicId, specialPracticeTopicSlug: entry.specialPracticeTopicSlug, specialPracticeTopicTitle: entry.specialPracticeTopicTitle, rationale: entry.rationale, proposalDigest: proposalSha256, approvedAt, scope }))
  };
  const target = path.join(packDir, 'topic-mapping.json');
  if (fs.existsSync(target)) throw new Error('topic-mapping.json already exists; refusing to overwrite approval evidence');
  const temp = `${target}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(approved, null, 2)}\n`, { flag: 'wx' }); fs.renameSync(temp, target);
  console.log(`APPROVED ${approved.mappings.length} topic mappings; proposal SHA-256 ${proposalSha256}`);
}

if (require.main === module) { try { run(); } catch (error) { console.error(`APPROVAL ERROR: ${error.message}`); process.exitCode = 1; } }
module.exports = { run };
