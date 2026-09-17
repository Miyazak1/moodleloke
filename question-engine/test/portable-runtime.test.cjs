'use strict';

const assert = require('node:assert/strict');
const portable = require('../src/portable-index.cjs');

const cases = [
  { family: 'math_derivative', seed: 17, expected: 'generated_and_triple_verified' },
  { family: 'math_elementary', seed: 17, functionClass: 'logarithmic', propertyTarget: 'domain', expected: 'generated_and_self_verified' },
  { family: 'math_line_relation', seed: 17, exactScope: 'slope_from_two_distinct_points', expected: 'generated_and_triple_verified' },
  { family: 'physics_kinematics', seed: 17, relationKind: 'uniform_speed', expected: 'generated_and_self_verified' },
  { family: 'chemistry_acid_base', seed: 17, relationKind: 'strong_acid_dilution', answerTarget: 'ph_value', expected: 'generated_and_self_verified' }
];
for (const testCase of cases) {
  const expected = testCase.expected;
  const result = portable.generatePreview(testCase);
  assert.equal(result.status, expected);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.databaseReads, 0);
  assert.equal(result.databaseWrites, 0);
  assert.equal(result.studentPublicationAllowed, false);
  assert.equal(result.productionQualificationAllowed, false);
}
assert.throws(() => portable.generatePreview({ family: 'unknown', seed: 1 }), /not_registered/);
process.stdout.write('Question engine portable runtime tests passed.\n');
