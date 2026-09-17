'use strict';

const base = require('./subject-practice-post-freeze-random-manifest-v5-three-subject-engine-core.json');

module.exports = Object.freeze({
  ...base,
  manifestVersion: 'subject-practice-post-freeze-random-manifest-v6-five-family-engine-core',
  subjects: Object.freeze({
    ...base.subjects,
    math: Object.freeze({
      solverPath: 'question-engine/core/subject-practice-math-solver.ts',
      solverSha256: '0000872a1bb2e111d7b85b36266bfe57f9781ff5ad0da152d8d4520055374450',
      identityOwner: 'question_engine_core',
      compatibilityFacadePath: 'backend/src/ai-questioning/subject-practice-math-solver.ts',
      compatibilityFacadeExportTarget: '../../../question-engine/core/subject-practice-math-solver',
      generatorPath: 'question-engine/core/subject-practice-math-elementary-local-generator.ts',
      generatorSha256: '7b00818f272f6fdd7296447f2d49366468aac6569ad61ebd6a693f076d3bea38',
      generatorFacadePath: 'backend/src/ai-questioning/subject-practice-math-elementary-local-generator.ts',
      generatorFacadeImportTarget: '../../../question-engine/core/subject-practice-math-elementary-local-generator',
      seedNamespace: base.subjects.math.seedNamespace,
      seedCommitmentSha256: base.subjects.math.seedCommitmentSha256
    })
  })
});
