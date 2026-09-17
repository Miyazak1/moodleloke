const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
const auditPath = path.join(root, 'artifacts/product-boundary-audit.json');
if (!fs.existsSync(auditPath)) throw new Error('Run npm run audit:product-boundaries first.');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const evidence = new Map(audit.prisma.models.map((item) => [item.model, item]));
const legacyArchive = new Set(['PublicContentBlock', 'CityGuide', 'ApplicationTimelineWindow', 'SchoolRaw', 'CartItem', 'Order', 'OrderItem', 'Payment', 'PaymentCallbackLog']);
const futurePatterns = /^(Teaching|Agent|Learning|Csca|Student|MockExam|PastPaper|Organization|QuestionSupply|Assessment|ExamScoring|ItemCalibration|ForecastCalibration|Score)/;
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((match) => {
  const name = match[1]; const block = match[2]; const item = evidence.get(name) || {};
  const table = block.match(/@@map\("([^"]+)"\)/)?.[1] || name;
  let disposition = 'manual-review'; let rationale = 'No direct runtime reference; relation and migration review required.';
  if (!item.reviewCandidate) { disposition = 'runtime-keep'; rationale = 'Referenced by the reachable backend runtime.'; }
  else if (legacyArchive.has(name)) { disposition = 'legacy-archive-candidate'; rationale = 'Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain.'; }
  else if (futurePatterns.test(name)) { disposition = 'future-platform-keep'; rationale = 'Reserved for Agent learning, authoring, assessment, or future teaching platform capability.'; }
  return { model: name, table, disposition, rationale, prismaAccessorMentions: item.prismaAccessorMentions || 0, typeMentions: item.typeMentions || 0 };
});
const counts = models.reduce((result, item) => ({ ...result, [item.disposition]: (result[item.disposition] || 0) + 1 }), {});
const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), policy: 'copy-all-first-prune-later', counts, models };
const dir = path.join(root, 'artifacts'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'prisma-model-retention.json'), JSON.stringify(report, null, 2) + '\n');
const lines = ['# Prisma model retention matrix', '', 'Policy: copy all models during initial migration; prune only after relation, SQL, migration and rollback review.', '', '| Model | Table | Disposition | Evidence |', '| --- | --- | --- | --- |', ...models.map((item) => '| ' + item.model + ' | ' + item.table + ' | ' + item.disposition + ' | ' + item.rationale + ' |')];
fs.writeFileSync(path.join(dir, 'prisma-model-retention.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ total: models.length, counts }));
