'use strict';

const runtime = require('./runtime.cjs');

module.exports = Object.freeze({
  apiVersion: runtime.ENGINE_API_VERSION,
  capabilityCatalog: runtime.capabilityCatalog,
  generateChemistryAcidBasePreview: runtime.generateChemistryAcidBasePreview,
  generateMathDerivativePreview: runtime.generateMathDerivativePreview,
  generateMathElementaryPreview: runtime.generateMathElementaryPreview,
  generateMathLineRelationPreview: runtime.generateMathLineRelationPreview,
  generatePhysicsKinematicsPreview: runtime.generatePhysicsKinematicsPreview,
  qualificationBatchPreview: runtime.qualificationBatchPreview,
  releaseReadiness: runtime.releaseReadiness
});
