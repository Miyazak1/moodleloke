const MATH_ELEMENTARY_DIRECT_PROPERTY_VALIDATION_PROTOCOL = 'math-elementary-direct-property-rotation-v3';

function validationProtocolForTarget({ subject, productionRunId, productionCellId, taskFamily }) {
  if (String(subject || '').trim().toLowerCase() === 'math'
    && Number(productionRunId) === 1
    && Number(productionCellId) === 16
    && String(taskFamily || '').trim() === 'elementary_function_direct_property') {
    return MATH_ELEMENTARY_DIRECT_PROPERTY_VALIDATION_PROTOCOL;
  }
  return null;
}

module.exports = {
  MATH_ELEMENTARY_DIRECT_PROPERTY_VALIDATION_PROTOCOL,
  validationProtocolForTarget
};
