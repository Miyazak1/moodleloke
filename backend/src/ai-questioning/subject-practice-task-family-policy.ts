export const SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION = 'subject-practice-task-family-policy-v16';
export const SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION = 'subject-practice-question-fingerprint-v16';
export const SUBJECT_PRACTICE_DIVERSITY_WINDOW_POLICY_VERSION = 'subject-practice-diversity-window-v1';
export const SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION = 'subject-practice-scheduler-v2';
export const SUBJECT_PRACTICE_NEAR_DUPLICATE_POLICY_VERSION = 'subject-practice-near-duplicate-v1';

export type SubjectPracticeRepresentationType =
  | 'text'
  | 'equation'
  | 'table'
  | 'graph'
  | 'diagram'
  | 'circuit'
  | 'experiment';

export type SubjectPracticeQuantitativeShape =
  | 'direct_formula'
  | 'multi_step'
  | 'parameter_constraint'
  | 'comparison'
  | 'proof_like';

export type SubjectPracticeAnswerForm =
  | 'numeric'
  | 'expression'
  | 'option_judgement'
  | 'ranking'
  | 'explanation';

export type SubjectPracticeQuestionFingerprint = {
  subject: string;
  topicId: number | null;
  topicTitle: string | null;
  difficulty: string;
  taskFamily: string;
  topicCompatibility: SubjectPracticeTaskFamilyTopicCompatibility;
  reasoningPath: string[];
  representationType: SubjectPracticeRepresentationType;
  quantitativeShape: SubjectPracticeQuantitativeShape;
  answerForm: SubjectPracticeAnswerForm;
  objects: string[];
  subjectExtension: Record<string, unknown>;
  policyVersion: string;
  taskFamilyPolicyVersion: string;
  fingerprintPolicyVersion: string;
};

export type SubjectPracticeTaskFamilyTopicCompatibility = {
  compatible: boolean;
  topicDomain: string | null;
  familyDomain: string | null;
  reasonCode: string | null;
};

export type SubjectPracticeDiversityWindowDecision = 'pass' | 'warn' | 'regenerate' | 'block_current_policy';
export type SubjectPracticeDiversityFamilyWindowScope =
  | 'legacy_gated'
  | 'classifier_visible_audit_only'
  | 'fallback_other'
  | 'ungated';

export type SubjectPracticeDiversityWindowResult = {
  policyVersion: string;
  taskFamilyPolicyVersion: string;
  diversityWindowPolicyVersion: string;
  familyWindowScope: SubjectPracticeDiversityFamilyWindowScope;
  activeWindow: boolean;
  decision: SubjectPracticeDiversityWindowDecision;
  candidateFamily: string;
  acceptedCount: number;
  acceptedFamilyCount: number;
  recentWindowSize: number;
  recentFamilyCount: number;
  nextFamilyShare: number;
  reasons: string[];
  repeatedReasoningPath: string[];
  repeatedPatterns: string[];
};

export type SubjectPracticeSchedulerHint = {
  policyVersion: string;
  schedulerPolicyVersion: string;
  subject: string;
  preferredFamily: string;
  preferredFamilyLabel?: string;
  preferredFamilyInstruction?: string;
  targetProfileQuestionForm?: string | null;
  targetProfileCalculationLoad?: string | null;
  targetProfileCompatibility?: 'target_profile_primary_scheduler_shape_secondary';
  targetProfileConstraintPressure?: 'concept_judgement_heavy_calculation';
  deliveryCooldownFamilies?: string[];
  deliveryFailurePolicy?: 'deprioritize_for_delivery_only_not_quality_memory';
  diversityBlockedFamilies?: string[];
  diversityWindowPolicy?: 'avoid_legacy_gate_blocked_family';
  avoidFamilies: string[];
  avoidFamilyLabels?: string[];
  reason: string;
  questionPlanAuthority?: 'validated_exact_question_plan';
};

export type SubjectPracticeNearDuplicateQuestion = {
  id?: number | string | null;
  subject?: string | null;
  topicId?: number | string | null;
  topicTitle?: string | null;
  difficulty?: string | null;
  taskFamily?: string | null;
  fingerprint?: SubjectPracticeQuestionFingerprint | null;
  prompt?: string | null;
  options?: unknown;
  explanation?: string | null;
};

export type SubjectPracticeNearDuplicateSignal = {
  policyVersion: string;
  nearDuplicatePolicyVersion: string;
  decision: 'pass' | 'warn';
  reasonCode: 'fingerprint_near_duplicate' | null;
  nearestId: number | string | null;
  similarity: number;
  similaritySource: 'token_jaccard' | 'expression_signature' | null;
  textSimilarity: number;
  expressionSimilarity: number;
  sharedFamily: boolean;
  candidateFamily: string;
  nearestFamily: string | null;
  comparedCount: number;
};

export type SubjectPracticeTaskFamilyPolicy = {
  policyVersion: string;
  taskFamily: string;
  selectedVariant: string;
  selectedVariantLabel: string;
  deliveryCooldownVariants?: string[];
  deliveryFailurePolicy?: 'deprioritize_for_delivery_only_not_quality_memory';
  requiredReasoningMoves: string[];
  bannedMediumShortcut: string;
  difficultyRubric: string[];
  retryPressure: boolean;
};

export type SubjectPracticeTaskFamilyDiversityBlock = {
  policyVersion: string;
  reasonCode: 'subject_practice_task_family_overrepresented';
  candidateFamily: string;
  acceptedCount: number;
  acceptedFamilyCount: number;
  nextFamilyShare: number;
  repeatedPatterns: string[];
};

export type SubjectPracticeMathDifficultyAudit = {
  policyVersion: string;
  severity: 'P1' | 'P2';
  reasonCode: string;
  taskFamily: string;
  message: string;
};

export type SubjectPracticePhysicsDifficultyAudit = {
  policyVersion: string;
  severity: 'P1' | 'P2';
  reasonCode: string;
  taskFamily: string;
  message: string;
};

type HardEquilibriumVariant = {
  key: string;
  label: string;
  requiredMoves: string[];
  bannedShortcut: string;
};

type BasicChemistryObservationTopic = 'periodic' | 'bond';

type BasicChemistryObservationVariant = {
  topic: BasicChemistryObservationTopic;
  key: string;
  label: string;
  requiredMoves: string[];
  bannedShortcut: string;
};

type ChemistryProductionTaskFamilyTarget = 'medium_periodic' | 'hard_periodic' | 'hard_bond';

type ChemistryProductionTaskFamilyVariant = {
  target: ChemistryProductionTaskFamilyTarget;
  key: string;
  label: string;
  requiredMoves: string[];
  bannedShortcut: string;
};

type MathProductionTaskFamilyTarget =
  | 'basic_probability'
  | 'medium_probability'
  | 'basic_normal_distribution'
  | 'medium_normal_distribution'
  | 'hard_normal_distribution'
  | 'basic_derivative'
  | 'basic_sequence'
  | 'basic_statistics'
  | 'basic_function'
  | 'basic_elementary_function'
  | 'medium_elementary_function'
  | 'hard_elementary_function'
  | 'basic_geometry'
  | 'basic_vector_complex'
  | 'medium_sequence'
  | 'hard_sequence'
  | 'medium_statistics'
  | 'hard_statistics'
  | 'medium_vector_complex'
  | 'medium_geometry'
  | 'hard_vector_complex'
  | 'hard_spatial'
  | 'medium_function'
  | 'hard_function'
  | 'hard_probability'
  | 'generic_hard_math';

type MathProductionTaskFamilyVariant = {
  target: MathProductionTaskFamilyTarget;
  key: string;
  label: string;
  requiredMoves: string[];
  bannedShortcut: string;
};

const HARD_EQUILIBRIUM_VARIANTS: HardEquilibriumVariant[] = [
  {
    key: 'two_stage_qk_then_temperature_or_catalyst',
    label: 'two-stage Q/K comparison followed by a separate temperature/catalyst conclusion',
    requiredMoves: [
      'compare Q and K after the first perturbation',
      'infer shift or no-shift direction',
      'separately judge heat-effect or catalyst rate/no-shift consequence'
    ],
    bannedShortcut: 'single Q/K shift direction with no independent second conclusion'
  },
  {
    key: 'competing_volume_and_composition_effect',
    label: 'competing volume-pressure and composition change with amount fraction or rate comparison',
    requiredMoves: [
      'separate concentration or partial-pressure change from total-pressure wording',
      'compare Q/K or conversion trend',
      'judge amount fraction, concentration order, or rate consequence'
    ],
    bannedShortcut: 'pure pressure-volume Le Chatelier recall'
  },
  {
    key: 'conversion_yield_direction_from_two_conditions',
    label: 'conversion/yield direction inferred from two equilibrium conditions',
    requiredMoves: [
      'use one stated conversion/yield datum to infer K or heat direction',
      'apply a second perturbation to predict new conversion/yield',
      'reject a tempting rate-only or pressure-only misconception'
    ],
    bannedShortcut: 'one direct conversion statement where the answer is already visible'
  },
  {
    key: 'rate_versus_equilibrium_distinction',
    label: 'rate-versus-equilibrium distinction under catalyst, temperature, or concentration changes',
    requiredMoves: [
      'judge equilibrium position or K separately from rate',
      'compare both forward and reverse rate effects',
      'connect the rate conclusion to a separate amount, conversion, or no-shift conclusion'
    ],
    bannedShortcut: 'direct catalyst no-shift concept recall'
  }
];

const BASIC_CHEMISTRY_OBSERVATION_VARIANTS: BasicChemistryObservationVariant[] = [
  {
    topic: 'periodic',
    key: 'metal_activity_single_observation',
    label: 'one metal-activity observation leading to one periodic-trend conclusion',
    requiredMoves: [
      'state one concrete observation such as reaction vigor or displacement',
      'map the observation to one trend: metallic character or activity',
      'choose one direct conclusion without ranking three or more species'
    ],
    bannedShortcut: 'three-ion radius ranking or abstract correct-statement list in a basic periodic cell'
  },
  {
    topic: 'periodic',
    key: 'halogen_displacement_single_observation',
    label: 'one halogen displacement observation leading to one nonmetallicity conclusion',
    requiredMoves: [
      'state one displacement or non-displacement observation',
      'map it to one halogen activity or nonmetallicity trend',
      'reject one reversed-trend misconception'
    ],
    bannedShortcut: 'combining displacement, radius, electronegativity, and oxide property in one basic stem'
  },
  {
    topic: 'periodic',
    key: 'oxide_property_single_observation',
    label: 'one oxide acidity/basicity observation leading to one periodic-position conclusion',
    requiredMoves: [
      'state one oxide or hydrate acid-base observation',
      'map it to one metallic/nonmetallic trend',
      'keep the answer to one direct conclusion'
    ],
    bannedShortcut: 'multi-element oxide ranking with hidden group/period inference'
  },
  {
    topic: 'periodic',
    key: 'two_ion_same_electron_direct_radius',
    label: 'two same-electron ions compared by nuclear charge with one radius conclusion',
    requiredMoves: [
      'compare exactly two ions with the same electron configuration',
      'use nuclear charge to decide the radius order',
      'avoid adding a second periodic property conclusion'
    ],
    bannedShortcut: 'three-or-more ion radius ordering with broad generalization options'
  },
  {
    topic: 'bond',
    key: 'ionic_solid_state_conductivity',
    label: 'one ionic-solid state or conductivity observation leading to one bond-type conclusion',
    requiredMoves: [
      'state one property observation such as solid versus molten conductivity',
      'map it to ionic particles and mobility',
      'choose one direct bond-type conclusion'
    ],
    bannedShortcut: 'multi-property solid classification that requires two independent bond/force distinctions'
  },
  {
    topic: 'bond',
    key: 'molecular_solid_sublimation',
    label: 'one molecular-solid sublimation or low-melting observation leading to one force conclusion',
    requiredMoves: [
      'state one physical property observation such as sublimation or low melting point',
      'map it to molecular particles and intermolecular force',
      'reject one ionic-network misconception'
    ],
    bannedShortcut: 'pure definition list of ionic, covalent, and intermolecular-force statements'
  },
  {
    topic: 'bond',
    key: 'hydrogen_bond_single_anomaly',
    label: 'one hydrogen-bond boiling-point anomaly leading to one force conclusion',
    requiredMoves: [
      'state one boiling-point or solubility anomaly',
      'connect the anomaly to hydrogen bonding',
      'keep the conclusion to one substance-family comparison'
    ],
    bannedShortcut: 'ranking several hydrides or requiring a second polarity/dispersion-force comparison'
  },
  {
    topic: 'bond',
    key: 'mixed_bond_salt_single_fact',
    label: 'one mixed-bond salt observation leading to one ionic-plus-covalent conclusion',
    requiredMoves: [
      'state one named salt or ion-group observation',
      'identify ionic bonding between ions and covalent bonding inside a polyatomic ion',
      'avoid adding conductivity or melting-point inference as a second step'
    ],
    bannedShortcut: 'two-property NH4Cl/NH4NO3 comparison with multiple answer claims'
  }
];

const CHEMISTRY_PRODUCTION_TASK_FAMILY_VARIANTS: ChemistryProductionTaskFamilyVariant[] = [
  {
    target: 'medium_periodic',
    key: 'periodic_same_period_group_dual_clue',
    label: 'same-period or same-group trend comparison using two visible clues',
    requiredMoves: [
      'identify the period or group relation from the stem',
      'use two stated observations or position clues',
      'choose a conclusion that combines both trend directions'
    ],
    bannedShortcut: 'single periodic-trend recall wrapped as a correct-statement list'
  },
  {
    target: 'medium_periodic',
    key: 'periodic_halogen_displacement_plus_trend',
    label: 'halogen displacement evidence plus one radius or nonmetallicity comparison',
    requiredMoves: [
      'read one halogen displacement or non-displacement observation',
      'connect it to oxidizing ability or nonmetallicity',
      'combine it with one second trend clue such as radius or electronegativity'
    ],
    bannedShortcut: 'one KI/chlorine-water color observation with no independent second trend'
  },
  {
    target: 'medium_periodic',
    key: 'periodic_metal_activity_oxide_dual_evidence',
    label: 'metal activity evidence plus oxide acidity/basicity comparison',
    requiredMoves: [
      'use one metal reactivity observation',
      'use one oxide or hydrate acid-base property',
      'reject an answer that follows only one of the two clues'
    ],
    bannedShortcut: 'generic displacement wording that does not distinguish metal activity from halogen displacement'
  },
  {
    target: 'medium_periodic',
    key: 'periodic_same_electron_radius_plus_position',
    label: 'same-electron ion-radius comparison plus one periodic-position clue',
    requiredMoves: [
      'compare same-electron ions by nuclear charge',
      'use one additional period or group clue',
      'combine radius and position evidence in the final judgement'
    ],
    bannedShortcut: 'basic two-ion radius comparison with no second clue'
  },
  {
    target: 'hard_periodic',
    key: 'periodic_unknown_element_electron_hydride_clue',
    label: 'unknown short-period elements from electron configuration plus hydride or oxide clue',
    requiredMoves: [
      'infer candidate elements from electron configuration or ion structure',
      'apply one hydride or oxide property clue',
      'rank or eliminate options using both identity and property evidence'
    ],
    bannedShortcut: 'direct element-position recall with no hidden identity step'
  },
  {
    target: 'hard_periodic',
    key: 'periodic_ionization_energy_exception',
    label: 'first-ionization-energy exception plus group/period inference',
    requiredMoves: [
      'infer relative positions for at least three elements',
      'handle one known ionization-energy exception',
      'connect the exception to a separate property or structure conclusion'
    ],
    bannedShortcut: 'smooth monotonic trend ranking with no exception or second conclusion'
  },
  {
    target: 'hard_periodic',
    key: 'periodic_oxide_radius_valence_elimination',
    label: 'oxide hydrate acidity/basicity plus radius or valence elimination',
    requiredMoves: [
      'use oxide or hydrate acid-base property to constrain element type',
      'use radius, valence, or electron-layer evidence as a second constraint',
      'eliminate a tempting option that satisfies only one constraint'
    ],
    bannedShortcut: 'medium oxide-property observation with no multi-constraint elimination'
  },
  {
    target: 'hard_periodic',
    key: 'periodic_compound_formula_property_ranking',
    label: 'compound formula and valence clue before property ranking',
    requiredMoves: [
      'infer element identity or group from compound formula',
      'use valence or atomic structure as a second clue',
      'rank a property only after resolving the identities'
    ],
    bannedShortcut: 'property ranking directly visible from named elements'
  },
  {
    target: 'hard_bond',
    key: 'bond_isomer_branching_dispersion_data',
    label: 'isomer boiling-point or vaporization data with branching and surface-area interpretation',
    requiredMoves: [
      'compare at least two numeric property differences',
      'connect branching or surface area to dispersion-force strength',
      'use the calculated comparison before the force conclusion'
    ],
    bannedShortcut: 'single isomer boiling-point recall with no numeric comparison'
  },
  {
    target: 'hard_bond',
    key: 'bond_ionic_molecular_solid_data_anomaly',
    label: 'ionic versus molecular solid data anomaly requiring particle-force interpretation',
    requiredMoves: [
      'read two physical-property data points',
      'classify the particle or bonding type from the data',
      'explain the anomalous property by lattice or intermolecular force'
    ],
    bannedShortcut: 'medium ionic-solid conductivity fact with one property only'
  },
  {
    target: 'hard_bond',
    key: 'bond_energy_enthalpy_data_anomaly',
    label: 'bond-energy or vaporization-enthalpy anomaly with two calculated comparisons',
    requiredMoves: [
      'calculate or compare two energy differences',
      'separate bond energy from intermolecular-force contribution',
      'choose the option that matches both numerical and force evidence'
    ],
    bannedShortcut: 'one direct bond-energy substitution with no anomaly interpretation'
  },
  {
    target: 'hard_bond',
    key: 'bond_polarity_hbond_dispersion_data',
    label: 'polarity, hydrogen-bond, and dispersion data where at least two predictions are compared',
    requiredMoves: [
      'compare polarity or hydrogen-bond capability',
      'compare dispersion-force or molar-mass contribution',
      'resolve the final answer from the competing force explanations'
    ],
    bannedShortcut: 'direct H2O/HF hydrogen-bond recall or hydride boiling-point template'
  }
];

const MATH_PRODUCTION_TASK_FAMILY_VARIANTS: MathProductionTaskFamilyVariant[] = [
  {
    target: 'basic_probability',
    key: 'basic_probability_finite_sample_space_one_count',
    label: 'finite sample-space probability with one favorable-count calculation',
    requiredMoves: [
      'state a concrete finite sample space',
      'count favorable outcomes in one visible step',
      'return one probability value or equivalent fraction'
    ],
    bannedShortcut: 'concept-only classical-probability definition or applicability judgement'
  },
  {
    target: 'basic_probability',
    key: 'basic_probability_complement_one_step',
    label: 'one-step complement probability in a finite sample space',
    requiredMoves: [
      'state the total number of equally likely outcomes',
      'count the excluded or complement outcomes',
      'compute the requested probability'
    ],
    bannedShortcut: 'asking only whether events are equally likely without computing a probability'
  },
  {
    target: 'medium_probability',
    key: 'probability_two_event_relation',
    label: 'two connected event or counting relations',
    requiredMoves: [
      'state the finite sample space or probability frame',
      'define two connected events, counts, complement, or conditional relation',
      'compare or combine the relations before option judgement'
    ],
    bannedShortcut: 'single favorable-count probability result with no second event or relation'
  },
  {
    target: 'medium_probability',
    key: 'normal_distribution_standardization_interval',
    label: 'normal distribution standardization plus interval probability',
    requiredMoves: [
      'state N(mu,sigma^2) or a standard-normal frame',
      'standardize one threshold or interval to a z-score',
      'use a Phi value, symmetry, or interval relation before option judgement'
    ],
    bannedShortcut: 'normal-distribution concept statement without a threshold, interval, z-score, or probability event'
  },
  {
    target: 'basic_normal_distribution',
    key: 'basic_normal_distribution_threshold_or_z_claim',
    label: 'basic normal distribution threshold or z-score claim',
    requiredMoves: [
      'state a normal or standard-normal distribution',
      'give one threshold, interval, z-score, Phi value, or symmetry fact',
      'select one short probability or area claim'
    ],
    bannedShortcut: 'concept-only normal-distribution definition with no numeric threshold, interval, or z-score'
  },
  {
    target: 'medium_normal_distribution',
    key: 'normal_distribution_standardization_interval',
    label: 'normal distribution standardization plus interval probability',
    requiredMoves: [
      'state N(mu,sigma^2) or a standard-normal frame',
      'standardize one threshold or interval to a z-score',
      'use a Phi value, symmetry, or interval relation before option judgement'
    ],
    bannedShortcut: 'normal-distribution statement shell without a threshold, interval, z-score, or probability event'
  },
  {
    target: 'hard_normal_distribution',
    key: 'normal_distribution_inverse_standardization_tail_relation',
    label: 'hard normal distribution inverse-standardization relation',
    requiredMoves: [
      'combine two visible tail, interval, or symmetry probability constraints',
      'standardize or inverse-standardize to solve a threshold, mean, or standard deviation',
      'round-trip check the probability relation before option elimination'
    ],
    bannedShortcut: 'one Phi lookup or single symmetry fact dressed as hard normal-distribution reasoning'
  },
  {
    target: 'basic_derivative',
    key: 'basic_derivative_direct_value_or_slope',
    label: 'direct derivative value or tangent slope at one point',
    requiredMoves: [
      'differentiate one elementary function',
      'substitute one point or read one slope condition',
      'select the resulting derivative value or tangent slope'
    ],
    bannedShortcut: 'piecewise differentiability, parameter continuity, or multi-condition tangent system'
  },
  {
    target: 'basic_derivative',
    key: 'basic_derivative_monotonic_sign_judgement',
    label: 'single derivative-sign judgement on one interval',
    requiredMoves: [
      'compute or read the derivative sign',
      'connect the sign to increasing or decreasing behavior',
      'choose one interval or statement'
    ],
    bannedShortcut: 'abstract theorem recall with no derivative expression or interval evidence'
  },
  {
    target: 'basic_sequence',
    key: 'basic_sequence_one_parameter_then_term',
    label: 'one sequence parameter followed by one term or sum value',
    requiredMoves: [
      'state an arithmetic or geometric sequence with one explicit relation',
      'derive one parameter or common difference/ratio',
      'compute one requested term or short partial sum'
    ],
    bannedShortcut: 'definition-only arithmetic/geometric sequence recognition without a computed result'
  },
  {
    target: 'basic_sequence',
    key: 'basic_sequence_explicit_formula_substitution',
    label: 'explicit formula sequence substitution with one visible computation',
    requiredMoves: [
      'give a clear nth-term or partial-sum formula',
      'substitute one index value',
      'select the resulting value'
    ],
    bannedShortcut: 'medium-style recurrence, multiple hidden parameters, or proof of a general property'
  },
  {
    target: 'basic_statistics',
    key: 'basic_statistics_short_dataset_one_statistic',
    label: 'short data set with one mean, median, range, or variance calculation',
    requiredMoves: [
      'state a short concrete data set',
      'compute one named statistic directly',
      'return the numeric statistic or a simple comparison'
    ],
    bannedShortcut: 'definition-only statistic identification or long changed-sample inference'
  },
  {
    target: 'basic_statistics',
    key: 'basic_statistics_one_removed_or_added_value',
    label: 'one removed or added value inferred from an average',
    requiredMoves: [
      'state the original or changed average and count',
      'use total-sum reasoning once',
      'compute the missing added or removed value'
    ],
    bannedShortcut: 'multi-group pooled variance or two-statistic comparison'
  },
  {
    target: 'basic_function',
    key: 'basic_function_direct_value_domain_or_range',
    label: 'direct function value, domain, or range check',
    requiredMoves: [
      'state one elementary function or expression',
      'evaluate one value or identify one immediate domain/range condition',
      'select the single correct result or judgement'
    ],
    bannedShortcut: 'piecewise function, universal quantifier, or four-condition property stack'
  },
  {
    target: 'basic_function',
    key: 'basic_quadratic_vertex_axis_property',
    label: 'quadratic vertex, axis, or simple interval property',
    requiredMoves: [
      'state one quadratic function',
      'use vertex, axis, opening, or one root relation',
      'choose one directly evidenced property'
    ],
    bannedShortcut: 'parameterized quadratic system or multi-claim monotonicity/parity judgement'
  },
  {
    target: 'basic_elementary_function',
    key: 'basic_elementary_function_direct_value_or_domain',
    label: 'direct elementary-function value, domain, or monotonic fact',
    requiredMoves: [
      'state one exponential, logarithmic, or power expression',
      'evaluate one value or identify one direct domain, range, monotonicity, or comparison fact',
      'select one short result or claim'
    ],
    bannedShortcut: 'quadratic-only shell, function-list classification, or stacked property judgement'
  },
  {
    target: 'basic_geometry',
    key: 'basic_geometry_coordinate_metric',
    label: 'coordinate slope, distance, midpoint, or substitution metric',
    requiredMoves: [
      'give coordinates or one line/circle equation explicitly',
      'apply one coordinate formula or substitution',
      'return one metric or coordinate result'
    ],
    bannedShortcut: 'unseen diagram, line-plane theorem recall, or multi-constraint conic reasoning'
  },
  {
    target: 'basic_geometry',
    key: 'basic_geometry_simple_spatial_coordinate_metric',
    label: 'simple spatial coordinate metric',
    requiredMoves: [
      'state coordinates of two points or a rectangular-prism relation',
      'compute one distance, midpoint, symmetry coordinate, or diagonal',
      'select the numeric or coordinate answer'
    ],
    bannedShortcut: 'abstract spatial line-plane judgement without concrete coordinate evidence'
  },
  {
    target: 'basic_vector_complex',
    key: 'basic_vector_direct_norm_or_dot',
    label: 'direct vector norm, dot product, or coordinate operation',
    requiredMoves: [
      'state one or two concrete vectors',
      'compute one norm, dot product, coordinate, or angle cosine',
      'return the resulting value'
    ],
    bannedShortcut: 'locus, parameter, projection-chain, or multi-condition geometry system'
  },
  {
    target: 'basic_vector_complex',
    key: 'basic_complex_modulus_or_conjugate',
    label: 'direct complex modulus, conjugate, or real-imaginary part',
    requiredMoves: [
      'state one concrete complex number or one simple equation',
      'compute one conjugate, modulus, real part, imaginary part, or arithmetic result',
      'select the resulting value'
    ],
    bannedShortcut: 'complex locus, argument-region, or parameterized multi-equation reasoning'
  },
  {
    target: 'medium_sequence',
    key: 'sequence_sum_condition_then_term_property',
    label: 'sequence sum condition plus term property judgement',
    requiredMoves: [
      'translate one sum or index condition',
      'derive a sequence parameter or relation',
      'judge a term, monotonicity, or partial-sum property'
    ],
    bannedShortcut: 'direct two-equation a1/d solve where the final answer is one requested term'
  },
  {
    target: 'medium_sequence',
    key: 'sequence_arithmetic_geometric_comparison',
    label: 'arithmetic/geometric sequence comparison with an index condition',
    requiredMoves: [
      'identify whether the relation is arithmetic or geometric',
      'use an index or partial-sum condition',
      'reject a distractor that applies the wrong sequence model'
    ],
    bannedShortcut: 'number-swapped arithmetic-sequence first-term/common-difference template'
  },
  {
    target: 'hard_sequence',
    key: 'sequence_recurrence_to_closed_form_plus_inequality',
    label: 'recurrence or transformed sequence leading to a closed-form and inequality conclusion',
    requiredMoves: [
      'transform the recurrence or sequence relation',
      'derive a closed-form or monotonic relation',
      'use an inequality or parameter constraint before selecting the answer'
    ],
    bannedShortcut: 'solving two direct equations for a1 and common difference/ratio'
  },
  {
    target: 'hard_sequence',
    key: 'sequence_parameter_case_analysis',
    label: 'sequence parameter case analysis with partial-sum or monotonicity constraint',
    requiredMoves: [
      'introduce a parameter from the stated sequence condition',
      'split or eliminate cases',
      'combine the case result with a term, sum, or monotonicity conclusion'
    ],
    bannedShortcut: 'single visible formula substitution for Sn or an'
  },
  {
    target: 'medium_statistics',
    key: 'statistics_missing_value_then_variance_or_range',
    label: 'missing value inferred from one statistic before comparing variance or range',
    requiredMoves: [
      'infer a missing or replaced value from mean/median information',
      'compute or compare a second statistic',
      'choose an interpretation tied to both statistics'
    ],
    bannedShortcut: 'one-step mean removed value by subtracting two totals'
  },
  {
    target: 'medium_statistics',
    key: 'statistics_grouped_frequency_weighted_mean',
    label: 'grouped-frequency weighted mean or proportion with interpretation',
    requiredMoves: [
      'read grouped frequency or proportion data',
      'compute a weighted mean or total',
      'interpret the result against one stated condition'
    ],
    bannedShortcut: 'bare average from a short list with no missing value or comparison'
  },
  {
    target: 'hard_statistics',
    key: 'statistics_combined_group_variance_inference',
    label: 'combined-group variance requiring between-group and within-group components',
    requiredMoves: [
      'separate within-group variance from between-group mean difference',
      'combine group sizes, means, and variances into one relation',
      'check the resulting statistic against a distractor that uses only weighted averages'
    ],
    bannedShortcut: 'direct variance formula with one short data list or a single weighted mean'
  },
  {
    target: 'hard_statistics',
    key: 'statistics_distribution_parameter_from_two_conditions',
    label: 'distribution or data-summary parameter inferred from two independent conditions',
    requiredMoves: [
      'translate two probability or statistic conditions into equations',
      'solve the hidden parameter or interval relation',
      'substitute back before selecting the answer'
    ],
    bannedShortcut: 'one z-score lookup, one mean calculation, or a direct standard deviation read-off'
  },
  {
    target: 'medium_geometry',
    key: 'geometry_coordinate_vector_distance_relation',
    label: 'coordinate/vector geometry distance relation with a derived object',
    requiredMoves: [
      'derive a coordinate, vector, normal, or line relation',
      'apply a distance, angle, or incidence formula',
      'check the answer against the geometric condition'
    ],
    bannedShortcut: 'concept-only line-plane or plane-plane judgement list'
  },
  {
    target: 'medium_geometry',
    key: 'geometry_condition_to_line_plane_relation',
    label: 'coordinate condition leading to a line-plane relation judgement',
    requiredMoves: [
      'translate coordinates into vector relations',
      'test parallel/perpendicular/incidence using a computed condition',
      'eliminate one tempting pure-concept statement'
    ],
    bannedShortcut: 'asking which line-plane theorem statement is correct with no computation'
  },
  {
    target: 'medium_vector_complex',
    key: 'vector_complex_two_object_relation_judgement',
    label: 'two-object vector/complex relation judgement',
    requiredMoves: [
      'state at most two vector or complex objects with explicit coordinates or algebraic form',
      'derive one relation such as norm, dot product, conjugate, or angle',
      'use that relation to judge exactly one option claim'
    ],
    bannedShortcut: 'turning a vector/complex cell into coordinate geometry, point-plane distance, or a one-step formula lookup'
  },
  {
    target: 'medium_vector_complex',
    key: 'complex_vector_conversion_then_property',
    label: 'complex-vector conversion followed by one property check',
    requiredMoves: [
      'convert once between complex notation and vector coordinates',
      'compute or compare one modulus, dot product, real part, or angle relation',
      'select a property judgement that depends on the conversion'
    ],
    bannedShortcut: 'adding locus, parameter-chain, or unrelated analytic-geometry conditions'
  },
  {
    target: 'hard_spatial',
    key: 'spatial_parameter_line_plane_condition',
    label: 'spatial line-plane condition with parameter solving',
    requiredMoves: [
      'represent a line, plane, or vector condition',
      'solve or constrain a parameter',
      'use the parameter result for a distance, angle, or relation conclusion'
    ],
    bannedShortcut: 'direct theorem recall about line-plane or plane-plane relationships'
  },
  {
    target: 'hard_spatial',
    key: 'spatial_multi_object_vector_angle_distance',
    label: 'multi-object vector geometry requiring angle and distance reasoning',
    requiredMoves: [
      'derive at least two vectors or a plane normal',
      'combine angle/distance/incidence conditions',
      'reject a distractor that satisfies only one geometric condition'
    ],
    bannedShortcut: 'single point-to-plane distance formula with all coordinates directly visible'
  },
  {
    target: 'hard_vector_complex',
    key: 'vector_complex_modulus_dot_round_trip',
    label: 'complex modulus relation converted to vector dot-product round trip',
    requiredMoves: [
      'translate modulus or conjugate notation into a vector/complex metric relation',
      'derive a hidden dot product, angle, or real-part value',
      'check the result against a second relation or distractor'
    ],
    bannedShortcut: 'single visible modulus calculation with no dot-product, angle, or conjugate relation'
  },
  {
    target: 'hard_vector_complex',
    key: 'vector_complex_parameter_locus_constraint',
    label: 'vector or complex parameter/locus constraint requiring elimination',
    requiredMoves: [
      'express the vector or complex condition algebraically',
      'solve or restrict a parameter, locus, or angle condition',
      'use the restriction to eliminate options'
    ],
    bannedShortcut: 'direct coordinate norm, direct conjugate equation, or one-step vector length'
  },
  {
    target: 'medium_function',
    key: 'function_domain_range_monotonicity_combined',
    label: 'domain/range plus monotonicity or parity combined judgement',
    requiredMoves: [
      'determine the domain or critical interval',
      'analyze range, monotonicity, or parity',
      'select the option that combines both facts'
    ],
    bannedShortcut: 'plain quadratic vertex/property identification only'
  },
  {
    target: 'medium_elementary_function',
    key: 'elementary_function_exp_log_ordering',
    label: 'exp/log/power ordering or bounded relation',
    requiredMoves: [
      'state two or three exponential, logarithmic, or power expressions',
      'use monotonicity, base comparison, domain, or a common bound',
      'select the comparison, interval, or relation supported by the bound'
    ],
    bannedShortcut: 'bare odd/even/increasing/decreasing function-list classification'
  },
  {
    target: 'medium_function',
    key: 'function_quadratic_parameter_property',
    label: 'quadratic or elementary-function property with a parameter condition',
    requiredMoves: [
      'extract a parameter or transformed expression',
      'use a property such as vertex, sign, domain, or monotonicity',
      'judge the resulting option after substitution or elimination'
    ],
    bannedShortcut: 'direct quadratic-function statement with no parameter or interval condition'
  },
  {
    target: 'hard_function',
    key: 'function_derivative_tangent_parameter_constraint',
    label: 'derivative/tangent condition with parameter or intersection constraint',
    requiredMoves: [
      'differentiate or form the tangent condition',
      'solve a parameter or intersection relation',
      'combine with monotonicity, extremum, or sign information'
    ],
    bannedShortcut: 'single derivative value or tangent slope substitution'
  },
  {
    target: 'hard_function',
    key: 'function_monotonicity_parity_counterexample',
    label: 'monotonicity/parity statement requiring counterexample or case analysis',
    requiredMoves: [
      'state the domain or transformation constraint',
      'analyze monotonicity/parity under cases',
      'use a counterexample or equivalence check before selecting the answer'
    ],
    bannedShortcut: 'one correct-statement list where every option is checked by direct recall'
  },
  {
    target: 'hard_elementary_function',
    key: 'hard_elementary_function_parameter_or_inequality',
    label: 'elementary-function parameter or inequality chain',
    requiredMoves: [
      'state an exponential, logarithmic, or power relation with a parameter, interval, or inequality',
      'transform the relation using monotonicity, domain, or bound evidence',
      'check the resulting parameter, interval, or comparison against the answer options'
    ],
    bannedShortcut: 'single exp/log value comparison or derivative/tangent condition outside the topic'
  },
  {
    target: 'hard_probability',
    key: 'probability_case_counting_with_condition',
    label: 'probability counting with cases and a conditional restriction',
    requiredMoves: [
      'split the sample space into cases',
      'apply a restriction such as at least/exactly/conditional event',
      'combine counts or probabilities before comparing options'
    ],
    bannedShortcut: 'one direct classical-probability fraction with all counts visible'
  },
  {
    target: 'hard_probability',
    key: 'probability_multi_event_relation',
    label: 'multi-event probability relation with dependence or complement reasoning',
    requiredMoves: [
      'identify event relations such as complement, inclusion, independence, or mutual exclusion',
      'compute at least two intermediate probabilities or counts',
      'combine them into the final conclusion'
    ],
    bannedShortcut: 'single event-counting task with no interaction between events'
  },
  {
    target: 'generic_hard_math',
    key: 'math_parameter_case_analysis',
    label: 'parameter case analysis requiring elimination before calculation',
    requiredMoves: [
      'introduce a parameter or hidden condition',
      'split or eliminate cases',
      'use the surviving case to compute or judge the answer'
    ],
    bannedShortcut: 'direct formula substitution or concept-only correct-statement judgement'
  },
  {
    target: 'generic_hard_math',
    key: 'math_multi_constraint_algebraic_reasoning',
    label: 'multi-constraint algebraic reasoning with a non-obvious intermediate',
    requiredMoves: [
      'translate at least two stated constraints',
      'derive a non-obvious intermediate relation',
      'use that relation to eliminate distractors or compute the result'
    ],
    bannedShortcut: 'one-step arithmetic or a transparent two-equation solve'
  }
];

const SUBJECT_PRACTICE_DIVERSITY_GATED_FAMILIES = new Set([
  'periodic_halogen_displacement_observation',
  'periodic_metal_activity_observation',
  'periodic_halogen_displacement_plus_trend',
  'periodic_metal_activity_oxide_dual_evidence',
  'periodic_same_period_group_dual_clue',
  'periodic_unknown_element_electron_hydride_clue',
  'periodic_ionization_energy_exception',
  'periodic_oxide_radius_valence_elimination',
  'periodic_compound_formula_property_ranking',
  'periodic_oxide_property_observation',
  'periodic_same_electron_ion_radius',
  'bond_ionic_solid_conductivity',
  'bond_ionic_molecular_solid_data_anomaly',
  'bond_molecular_solid_sublimation',
  'bond_hydrogen_bond_anomaly',
  'bond_hydrogen_bond_data_anomaly',
  'bond_isomer_branching_dispersion_data',
  'bond_energy_enthalpy_data_anomaly',
  'bond_polarity_hbond_dispersion_data',
  'bond_mixed_bond_salt_fact',
  'equilibrium_concentration_qk_perturbation',
  'equilibrium_pressure_volume_shift',
  'equilibrium_temperature_k_or_heat_shift',
  'equilibrium_catalyst_rate_contrast',
  'arithmetic_sequence_two_condition_solve_a1_d',
  'geometric_sequence_two_condition_solve_q',
  'finite_set_cardinality_complement',
  'mean_removed_value',
  'direct_variance_formula',
  'combined_variance',
  'spatial_coordinate_direct_metric',
  'coordinate_geometry_point_to_plane_distance',
  'spatial_line_plane_concept_judgement',
  'circle_line_chord_length',
  'conic_shared_focus_relation',
  'function_monotonicity_parity_statement',
  'derivative_tangent_constraint',
  'derivative_direct_evaluation',
  'quadratic_function_properties',
  'probability_multi_event_counting',
  'normal_distribution_z_score_probability',
  'complex_mod_vector_dot_product',
  'rational_inequality_solution_boundary'
]);

const SUBJECT_PRACTICE_CLASSIFIER_VISIBLE_AUDIT_ONLY_FAMILIES = new Set([
  'interval_set_operation_solution',
  'elementary_function_exp_log_ordering',
  'vector_coordinate_norm_dot_angle',
  'inequality_order_property_counterexample',
  'spatial_vector_angle_cosine',
  'logarithmic_equation_domain_solution',
  'complex_conjugate_linear_equation_solve'
]);

const PHYSICS_DIRECT_FORMULA_TASK_FAMILIES = new Set([
  'kinematics_constant_acceleration_direct',
  'coulomb_law_direct_calculation',
  'uniform_electric_field_potential_relation',
  'ampere_force_direct_calculation',
  'circuit_ohm_kirchhoff_resistor_network',
  'work_energy_conservation',
  'mechanical_wave_basic_relation',
  'experiment_graph_slope_intercept',
  'measurement_uncertainty_significant_figures',
  'photoelectric_effect_threshold_energy',
  'nuclear_mass_defect_energy_release'
]);

const MATH_HARD_SIMPLE_TASK_FAMILIES = new Set([
  'arithmetic_sequence_two_condition_solve_a1_d',
  'geometric_sequence_two_condition_solve_q',
  'finite_set_cardinality_complement',
  'mean_removed_value',
  'direct_variance_formula',
  'quadratic_function_properties',
  'spatial_coordinate_direct_metric',
  'spatial_line_plane_concept_judgement',
  'rational_inequality_solution_boundary'
]);

const MATH_MEDIUM_BASIC_TASK_FAMILIES = new Set([
  'mean_removed_value',
  'finite_set_cardinality_complement',
  'direct_variance_formula',
  'spatial_coordinate_direct_metric'
]);

const MATH_SCHEDULER_FAMILY_POOLS: Record<MathProductionTaskFamilyTarget, string[]> = {
  basic_probability: [
    'probability_multi_event_counting',
    'normal_distribution_z_score_probability'
  ],
  medium_probability: [
    'probability_multi_event_counting',
    'normal_distribution_z_score_probability'
  ],
  basic_normal_distribution: [
    'normal_distribution_z_score_probability'
  ],
  medium_normal_distribution: [
    'normal_distribution_z_score_probability'
  ],
  hard_normal_distribution: [
    'normal_distribution_z_score_probability'
  ],
  basic_derivative: [
    'derivative_direct_evaluation'
  ],
  basic_sequence: [
    'arithmetic_sequence_two_condition_solve_a1_d',
    'geometric_sequence_two_condition_solve_q'
  ],
  basic_statistics: [
    'direct_variance_formula',
    'mean_removed_value'
  ],
  basic_function: [
    'quadratic_function_properties',
    'elementary_function_exp_log_ordering',
    'function_monotonicity_parity_statement'
  ],
  basic_elementary_function: [
    'elementary_function_direct_property',
    'elementary_function_exp_log_ordering',
    'logarithmic_equation_domain_solution'
  ],
  basic_geometry: [
    'spatial_coordinate_direct_metric',
    'coordinate_geometry_point_to_plane_distance'
  ],
  basic_vector_complex: [
    'vector_coordinate_norm_dot_angle',
    'complex_conjugate_linear_equation_solve',
    'complex_mod_vector_dot_product'
  ],
  medium_sequence: [
    'arithmetic_sequence_two_condition_solve_a1_d',
    'geometric_sequence_two_condition_solve_q'
  ],
  hard_sequence: [
    'geometric_sequence_two_condition_solve_q',
    'arithmetic_sequence_two_condition_solve_a1_d'
  ],
  medium_statistics: [
    'combined_variance',
    'normal_distribution_z_score_probability',
    'mean_removed_value',
    'direct_variance_formula'
  ],
  hard_statistics: [
    'hard_statistics_multi_step_inference',
    'combined_variance'
  ],
  medium_vector_complex: [
    'vector_coordinate_norm_dot_angle',
    'complex_mod_vector_dot_product',
    'complex_conjugate_linear_equation_solve'
  ],
  medium_geometry: [
    'coordinate_geometry_point_to_plane_distance',
    'circle_line_chord_length',
    'spatial_coordinate_direct_metric',
    'spatial_line_plane_concept_judgement'
  ],
  hard_vector_complex: [
    'complex_mod_vector_dot_product',
    'vector_coordinate_norm_dot_angle',
    'complex_conjugate_linear_equation_solve'
  ],
  hard_spatial: [
    'conic_shared_focus_relation',
    'coordinate_geometry_point_to_plane_distance',
    'spatial_line_plane_concept_judgement'
  ],
  medium_function: [
    'function_monotonicity_parity_statement',
    'quadratic_function_properties',
    'rational_inequality_solution_boundary',
    'derivative_direct_evaluation'
  ],
  hard_function: [
    'hard_function_multi_condition_property',
    'function_monotonicity_parity_statement',
    'quadratic_function_properties',
    'rational_inequality_solution_boundary',
    'hard_elementary_function_parameter_or_inequality',
    'elementary_function_exp_log_ordering',
    'logarithmic_equation_domain_solution'
  ],
  medium_elementary_function: [
    'elementary_function_exp_log_ordering',
    'logarithmic_equation_domain_solution',
    'quadratic_function_properties'
  ],
  hard_elementary_function: [
    'hard_elementary_function_parameter_or_inequality',
    'elementary_function_exp_log_ordering',
    'logarithmic_equation_domain_solution'
  ],
  hard_probability: [
    'probability_multi_event_counting',
    'normal_distribution_z_score_probability'
  ],
  generic_hard_math: [
    'derivative_tangent_constraint',
    'conic_shared_focus_relation',
    'probability_multi_event_counting',
    'function_monotonicity_parity_statement'
  ]
};

const MATH_SCHEDULER_FAMILY_PROMPT_GUIDANCE: Record<string, { label: string; instruction: string }> = {
  arithmetic_sequence_two_condition_solve_a1_d: {
    label: 'arithmetic sequence two-condition solve',
    instruction: 'solve a1 and d from two sequence conditions before asking for a term, sum, or parameter'
  },
  geometric_sequence_two_condition_solve_q: {
    label: 'geometric sequence two-condition solve',
    instruction: 'solve q or a scale parameter from two geometric-sequence conditions before computing the requested value'
  },
  combined_variance: {
    label: 'combined or changed-sample variance',
    instruction: 'combine or compare variance after a sample/group change, not a direct one-step variance formula'
  },
  normal_distribution_z_score_probability: {
    label: 'normal distribution z-score probability',
    instruction: 'standardize to a z-score and use symmetry or interval probability reasoning'
  },
  hard_statistics_multi_step_inference: {
    label: 'hard statistics multi-step inference',
    instruction: 'combine changed data, grouped values, variance/mean relations, or a missing parameter before option elimination'
  },
  mean_removed_value: {
    label: 'removed-value mean inference',
    instruction: 'infer an unknown removed or added value from changed average data'
  },
  direct_variance_formula: {
    label: 'direct variance formula',
    instruction: 'use the variance formula directly with a short data set'
  },
  coordinate_geometry_point_to_plane_distance: {
    label: 'point-to-plane distance',
    instruction: 'compute a distance from coordinates or a plane relation, with the needed geometry data explicit'
  },
  circle_line_chord_length: {
    label: 'circle-line chord length',
    instruction: 'use circle-center, radius, and line distance to find a chord length or related parameter'
  },
  spatial_coordinate_direct_metric: {
    label: 'direct spatial coordinate metric',
    instruction: 'compute a coordinate distance, midpoint, or vector metric directly'
  },
  spatial_line_plane_concept_judgement: {
    label: 'line-plane concept judgement',
    instruction: 'judge a spatial line/plane relation from stated incidence or parallel/perpendicular conditions'
  },
  spatial_vector_angle_cosine: {
    label: 'spatial vector angle cosine',
    instruction: 'derive a 3D vector angle or cosine from coordinates or dot products'
  },
  vector_coordinate_norm_dot_angle: {
    label: 'vector coordinate norm/dot/angle relation',
    instruction: 'use two explicit 2D vectors or complex-as-vector objects and judge a norm, dot-product, angle, or perpendicular/parallel relation'
  },
  complex_mod_vector_dot_product: {
    label: 'complex modulus to vector dot-product relation',
    instruction: 'connect one complex modulus or conjugate relation to a vector norm, dot product, real part, or angle judgement'
  },
  complex_conjugate_linear_equation_solve: {
    label: 'complex conjugate linear relation',
    instruction: 'solve or transform one compact complex/conjugate relation before judging the corresponding vector or complex property'
  },
  conic_shared_focus_relation: {
    label: 'conic shared-focus relation',
    instruction: 'use shared foci or eccentricity constraints across conics before selecting the result'
  },
  derivative_direct_evaluation: {
    label: 'direct derivative evaluation',
    instruction: 'differentiate or evaluate a derivative at a point without turning it into a general function-property statement'
  },
  derivative_tangent_constraint: {
    label: 'derivative tangent constraint',
    instruction: 'use a tangent or slope constraint plus another condition to solve a parameter or intersection'
  },
  hard_function_multi_condition_property: {
    label: 'hard function multi-condition property',
    instruction: 'use a concrete function plus at least two visible property, interval, parameter, or value constraints before option elimination'
  },
  hard_elementary_function_parameter_or_inequality: {
    label: 'hard elementary-function parameter or inequality',
    instruction: 'combine an exponential, logarithmic, or power-function relation with a parameter, inequality, interval, or bound before selecting the answer'
  },
  inequality_order_property_counterexample: {
    label: 'inequality property counterexample',
    instruction: 'test inequality order properties using a concrete counterexample or sign/domain condition'
  },
  rational_inequality_solution_boundary: {
    label: 'rational inequality boundary solution',
    instruction: 'solve a rational inequality by sign intervals and endpoint/domain boundaries'
  },
  function_monotonicity_parity_statement: {
    label: 'function monotonicity/parity statement',
    instruction: 'ask a true/false property judgement about monotonicity, parity, domain, range, or symmetry'
  },
  quadratic_function_properties: {
    label: 'quadratic function properties',
    instruction: 'use vertex, axis, opening, roots, or interval monotonicity of a quadratic function'
  },
  logarithmic_equation_domain_solution: {
    label: 'log equation with domain constraints',
    instruction: 'use logarithmic equation, inequality, or domain constraints; for concept-judgement profiles, make the correct option a domain/solution/equivalent-transformation statement'
  },
  elementary_function_exp_log_ordering: {
    label: 'exp/log/power value ordering',
    instruction: 'compare/rank exponential, logarithmic, or power values; for concept-judgement profiles, make the correct option a comparison/order statement'
  },
  elementary_function_direct_property: {
    label: 'elementary-function direct property or value',
    instruction: 'use one explicit exponential, logarithmic, or power expression and ask for a direct value, domain, range, monotonicity, or comparison fact'
  },
  probability_multi_event_counting: {
    label: 'multi-event probability counting',
    instruction: 'count cases across at least two events or constraints before computing probability'
  }
};

function cleanPolicyText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function policyRecordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function subjectPracticeMathSchedulerTargetFor(input: {
  topicTitle?: string | null;
  difficulty?: string | null;
}): MathProductionTaskFamilyTarget | null {
  const topicText = cleanPolicyText(input.topicTitle).toLowerCase();
  const difficulty = cleanPolicyText(input.difficulty).toLowerCase();
  const normalDistributionTopic = /(正态分布|标准正态|normal distribution|standard normal|z[-_ ]?score|z分数)/i.test(topicText);
  const elementaryFunctionTopic = /(基本初等函数|对数|指数|幂函数|logarithm|exponential|power function)/i.test(topicText);
  if (normalDistributionTopic && difficulty === 'basic') return 'basic_normal_distribution';
  if (normalDistributionTopic && difficulty === 'medium') return 'medium_normal_distribution';
  if (normalDistributionTopic && difficulty === 'hard') return 'hard_normal_distribution';
  if (elementaryFunctionTopic && difficulty === 'basic') return 'basic_elementary_function';
  if (elementaryFunctionTopic && difficulty === 'medium') return 'medium_elementary_function';
  if (elementaryFunctionTopic && difficulty === 'hard') return 'hard_elementary_function';
  if (difficulty === 'basic' && /(概率|probability|counting|古典概型)/i.test(topicText)) return 'basic_probability';
  if (difficulty === 'basic' && /(导数|微积分|derivative|calculus)/i.test(topicText)) return 'basic_derivative';
  if (difficulty === 'basic' && /(数列|sequence)/i.test(topicText)) return 'basic_sequence';
  if (difficulty === 'basic' && /(数据|统计|平均数|方差|标准差|statistics|mean|variance|standard deviation|data)/i.test(topicText)) return 'basic_statistics';
  if (difficulty === 'basic' && /(向量|复数|vector|complex)/i.test(topicText)) return 'basic_vector_complex';
  if (difficulty === 'basic' && /(空间|立体|几何|坐标|直线|圆|geometry|coordinate|line|circle)/i.test(topicText)) return 'basic_geometry';
  if (difficulty === 'basic' && /(函数|对数|指数|不等式|function|logarithm|exponential|inequality)/i.test(topicText)) return 'basic_function';
  if (difficulty === 'medium' && /(数列|sequence)/i.test(topicText)) return 'medium_sequence';
  if (difficulty === 'hard' && /(数列|sequence)/i.test(topicText)) return 'hard_sequence';
  if (difficulty === 'medium' && /(概率|probability|counting|古典概型)/i.test(topicText)) return 'medium_probability';
  if (difficulty === 'medium' && /(数据|统计|平均数|方差|标准差|statistics|mean|variance|standard deviation|data)/i.test(topicText)) return 'medium_statistics';
  if (difficulty === 'medium' && /(向量|复数|vector|complex)/i.test(topicText)) return 'medium_vector_complex';
  if (difficulty === 'hard' && /(向量|复数|vector|complex)/i.test(topicText)) return 'hard_vector_complex';
  if (difficulty === 'medium' && /(空间|立体|几何|坐标|geometry|coordinate)/i.test(topicText)) return 'medium_geometry';
  if (difficulty === 'hard' && /(空间|立体|几何|坐标|geometry|coordinate)/i.test(topicText)) return 'hard_spatial';
  if (difficulty === 'medium' && /(函数|导数|微积分|不等式|function|calculus|derivative|inequality)/i.test(topicText)) return 'medium_function';
  if (difficulty === 'hard' && /(概率|probability|counting|古典概型)/i.test(topicText)) return 'hard_probability';
  if (difficulty === 'hard' && /(数据|统计|平均数|方差|标准差|statistics|mean|variance|standard deviation|data)/i.test(topicText)) return 'hard_statistics';
  if (difficulty === 'hard' && /(函数|导数|微积分|不等式|function|calculus|derivative|inequality)/i.test(topicText)) return 'hard_function';
  if (difficulty === 'hard') return 'generic_hard_math';
  return null;
}

function familyCounts(families: string[]) {
  const counts = new Map<string, number>();
  for (const family of families) {
    const cleanFamily = cleanPolicyText(family);
    if (!cleanFamily || cleanFamily === 'other') continue;
    counts.set(cleanFamily, (counts.get(cleanFamily) ?? 0) + 1);
  }
  return counts;
}

function optionalCleanFamilies(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanPolicyText(item)).filter(Boolean);
}

function mathSchedulerFamilyPromptGuidance(family: string) {
  return MATH_SCHEDULER_FAMILY_PROMPT_GUIDANCE[family] ?? {
    label: family,
    instruction: `generate a ${family} task-family shell`
  };
}

export function subjectPracticeAlignSchedulerHintWithQuestionPlan(input: {
  schedulerHint?: unknown;
  questionPlan?: unknown;
}): SubjectPracticeSchedulerHint | null {
  const schedulerHint = policyRecordFrom(input.schedulerHint);
  const questionPlan = policyRecordFrom(input.questionPlan);
  const preferredFamily = cleanPolicyText(questionPlan?.taskFamily);
  if (!schedulerHint || !preferredFamily) return null;
  const subject = cleanPolicyText(schedulerHint.subject || questionPlan?.subject).toLowerCase();
  if (!subject) return null;
  const preferredGuidance = mathSchedulerFamilyPromptGuidance(preferredFamily);
  const avoidFamilies = optionalCleanFamilies(schedulerHint.avoidFamilies)
    .filter((family) => family !== preferredFamily)
    .slice(0, 4);
  const deliveryCooldownFamilies = optionalCleanFamilies(schedulerHint.deliveryCooldownFamilies)
    .filter((family) => family !== preferredFamily)
    .slice(0, 4);
  const diversityBlockedFamilies = optionalCleanFamilies(schedulerHint.diversityBlockedFamilies)
    .filter((family) => family !== preferredFamily)
    .slice(0, 4);
  return {
    ...(schedulerHint as SubjectPracticeSchedulerHint),
    policyVersion: cleanPolicyText(schedulerHint.policyVersion) || SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION,
    schedulerPolicyVersion: cleanPolicyText(schedulerHint.schedulerPolicyVersion) || SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION,
    subject,
    preferredFamily,
    preferredFamilyLabel: preferredGuidance.label,
    preferredFamilyInstruction: preferredGuidance.instruction,
    deliveryCooldownFamilies,
    diversityBlockedFamilies,
    avoidFamilies,
    avoidFamilyLabels: avoidFamilies.map((family) => mathSchedulerFamilyPromptGuidance(family).label),
    reason: 'validated_question_plan_authoritative',
    questionPlanAuthority: 'validated_exact_question_plan'
  };
}

function schedulerTargetProfileQuestionForm(targetProfile: unknown) {
  return cleanPolicyText(policyRecordFrom(targetProfile)?.questionForm);
}

function schedulerTargetProfileCalculationLoad(targetProfile: unknown) {
  return cleanPolicyText(policyRecordFrom(targetProfile)?.calculationLoad);
}

export function subjectPracticeDiversityFamilyWindowScope(candidateFamily?: string | null): SubjectPracticeDiversityFamilyWindowScope {
  const family = cleanPolicyText(candidateFamily);
  if (!family || family === 'other' || family === 'unclassified') return 'fallback_other';
  if (SUBJECT_PRACTICE_DIVERSITY_GATED_FAMILIES.has(family)) return 'legacy_gated';
  if (SUBJECT_PRACTICE_CLASSIFIER_VISIBLE_AUDIT_ONLY_FAMILIES.has(family)) return 'classifier_visible_audit_only';
  return 'ungated';
}

function mathSchedulerFamilyPoolFor(target: MathProductionTaskFamilyTarget, topicText: string) {
  const pool = MATH_SCHEDULER_FAMILY_POOLS[target] ?? [];
  if ((target === 'basic_probability' || target === 'medium_probability' || target === 'hard_probability')
    && /(正态分布|标准正态|normal distribution|standard normal|z[-_ ]?score|z分数)/i.test(topicText)) {
    return ['normal_distribution_z_score_probability'];
  }
  if ((target === 'basic_probability' || target === 'medium_probability' || target === 'hard_probability')
    && /(古典概型|概率|probability|counting)/i.test(topicText)) {
    return ['probability_multi_event_counting'];
  }
  if (target === 'medium_function') {
    if (/(导数|微积分|calculus|derivative)/i.test(topicText)) {
      return [
        'derivative_direct_evaluation',
        'derivative_tangent_constraint',
        'function_monotonicity_parity_statement'
      ];
    }
    if (/(不等式|inequality)/i.test(topicText)) {
      return [
        'inequality_order_property_counterexample',
        'rational_inequality_solution_boundary',
        'function_monotonicity_parity_statement'
      ];
    }
    if (/(基本初等函数|对数|指数|幂函数|logarithm|exponential|power function)/i.test(topicText)) {
      return [
        'elementary_function_exp_log_ordering',
        'logarithmic_equation_domain_solution',
        'quadratic_function_properties'
      ];
    }
    return [
      'function_monotonicity_parity_statement',
      'quadratic_function_properties',
      'logarithmic_equation_domain_solution',
      'elementary_function_exp_log_ordering'
    ];
  }
  if (target === 'hard_function') {
    if (/(导数|微积分|calculus|derivative)/i.test(topicText)) {
      return [
        'derivative_tangent_constraint',
        'function_monotonicity_parity_statement'
      ];
    }
    if (/(基本初等函数|对数|指数|幂函数|logarithm|exponential|power function)/i.test(topicText)) {
      return [
        'hard_elementary_function_parameter_or_inequality',
        'elementary_function_exp_log_ordering',
        'logarithmic_equation_domain_solution'
      ];
    }
    if (/(不等式|inequality)/i.test(topicText)) {
      return [
        'rational_inequality_solution_boundary',
        'function_monotonicity_parity_statement'
      ];
    }
    return [
      'hard_function_multi_condition_property',
      'function_monotonicity_parity_statement',
      'quadratic_function_properties',
      'rational_inequality_solution_boundary'
    ];
  }
  if (target === 'medium_geometry') {
    if (/(空间|立体|space|spatial)/i.test(topicText)) {
      return [
        'coordinate_geometry_point_to_plane_distance',
        'spatial_coordinate_direct_metric',
        'spatial_line_plane_concept_judgement',
        'spatial_vector_angle_cosine'
      ];
    }
    if (/(平面解析|解析几何|圆|圆锥|circle|conic|analytic geometry)/i.test(topicText)) {
      return [
        'circle_line_chord_length',
        'conic_shared_focus_relation'
      ];
    }
  }
  if (target === 'hard_spatial') {
    if (/(平面解析|解析几何|圆|圆锥|circle|conic|analytic geometry)/i.test(topicText)) {
      return [
        'conic_shared_focus_relation',
        'circle_line_chord_length'
      ];
    }
    if (/(空间|立体|space|spatial)/i.test(topicText)) {
      return [
        'coordinate_geometry_point_to_plane_distance',
        'spatial_line_plane_concept_judgement',
        'spatial_vector_angle_cosine'
      ];
    }
  }
  return pool;
}

function optionText(options: unknown) {
  if (!Array.isArray(options)) return '';
  return options
    .map((option) => cleanPolicyText((option && typeof option === 'object' ? (option as Record<string, unknown>).text : option)))
    .filter(Boolean)
    .join(' ');
}

function subjectPracticeClassifyPhysicsTaskFamilyText(text: string) {
  if (/(玻尔|氢原子|能级|原子光谱|谱线|bohr|atomic energy level|spectral line).{0,220}(跃迁|光子|频率|波长|能量差|吸收|发射|transition|photon|frequency|wavelength|emission|absorption)|(?:跃迁|光子|频率|波长|能量差|吸收|发射|transition|photon|frequency|wavelength|emission|absorption).{0,220}(玻尔|氢原子|能级|原子光谱|谱线|bohr|atomic energy level|spectral line)/i.test(text)) return 'atomic_energy_level_spectrum_transition';
  if (/(原子结构|核外电子|电子层|基态|激发态|电离|atomic structure|electron shell|ground state|excited state|ionization).{0,220}(能量|能级|电子跃迁|吸收|发射|电子排布|energy|energy level|configuration)|(?:能量|能级|电子跃迁|吸收|发射|电子排布|energy|energy level|configuration).{0,220}(原子结构|核外电子|电子层|基态|激发态|电离|atomic structure|electron shell|ground state|excited state|ionization)/i.test(text)) return 'atomic_structure_ground_excited_ionization_concept';
  if (/(同位素|同中子素|同质异位素|isotope).{0,220}(质子数|中子数|质量数|电子数|原子核|proton|neutron|mass number)|(?:质子数|中子数|质量数|电子数|proton|neutron|mass number).{0,220}(同位素|同中子素|同质异位素|isotope)/i.test(text)) return 'nuclear_isotope_nucleon_composition_concept';
  if (/(核反应|β[-⁻]?\s*衰变|β衰变|alpha decay|beta decay|nuclear reaction).{0,260}(守恒|电荷数|反中微子|conservation|charge number)|(?:守恒|电荷数|反中微子|conservation|charge number).{0,260}(核反应|β[-⁻]?\s*衰变|β衰变|alpha decay|beta decay|nuclear reaction)/i.test(text)) return 'nuclear_reaction_charge_mass_conservation';
  if (/(分子间作用力|分子力|作用力\s*f|f\s*[-–—]?\s*r|f与分子间距|intermolecular force).{0,260}(势能|平衡位置|r0|引力|斥力|做功|potential energy|equilibrium distance|attractive|repulsive)|(?:势能|平衡位置|r0|引力|斥力|做功|potential energy|equilibrium distance).{0,260}(分子间作用力|分子力|作用力\s*f|f\s*[-–—]?\s*r|intermolecular force)/i.test(text)) return 'kinetic_molecular_force_potential_graph';
  if (/(阿伏伽德罗|na\b|n_a|avogadro|摩尔质量|molar mass).{0,260}(密度|分子直径|原子直径|球形|紧密排列|数量级|diameter|radius|density)|(?:密度|分子直径|原子直径|球形|紧密排列|数量级|diameter|radius|density).{0,260}(阿伏伽德罗|na\b|n_a|avogadro|摩尔质量|molar mass)/i.test(text)) return 'kinetic_molecular_size_density_avogadro_estimation';
  if (/(方均根速率|均方根速率|root-mean-square|rms speed|v_rms).{0,220}(摩尔质量|温度|理想气体|气体分子|r\s*=|3rt\/m|molar mass|temperature)|(?:摩尔质量|温度|理想气体|气体分子|molar mass|temperature).{0,220}(方均根速率|均方根速率|root-mean-square|rms speed|v_rms)/i.test(text)) return 'kinetic_molecular_rms_speed_calculation';
  if (/(分子动理论|分子热运动|布朗运动|扩散|平均动能|molecular kinetic|brownian|diffusion).{0,220}(温度|无规则|速率|内能|热运动|平均动能|temperature|random|speed|kinetic energy)|(?:温度|无规则|速率|内能|热运动|平均动能|temperature|random|speed|kinetic energy).{0,220}(分子动理论|分子热运动|布朗运动|扩散|平均动能|molecular kinetic|brownian|diffusion)/i.test(text)) return 'kinetic_molecular_temperature_energy_motion';
  if (/(气体压强|分子碰撞|分子数密度|平均速率|理想气体微观|gas pressure|molecular collision|number density).{0,220}(体积|温度|密度|压强|碰撞|器壁|pressure|volume|temperature|wall)|(?:体积|温度|密度|压强|碰撞|器壁|pressure|volume|temperature|wall).{0,220}(气体压强|分子碰撞|分子数密度|平均速率|理想气体微观|gas pressure|molecular collision|number density)/i.test(text)) return 'kinetic_molecular_gas_pressure_micro_model';
  if (/(热力学第一定律|第一定律|内能|δu|Δu|delta u|first law).{0,220}(热量|吸收|放出|做功|对外做功|p[-\s]?v\s*图|p-v图|循环|等压|等容|等温|heat|work)|(?:热量|吸收|放出|做功|对外做功|p[-\s]?v\s*图|p-v图|循环|等压|等容|等温|heat|work).{0,220}(热力学第一定律|第一定律|内能|δu|Δu|delta u|first law)/i.test(text)) return 'thermodynamics_first_law_heat_work';
  if (/(理想气体|等温|等压|等容|p[-\s]?v图|p[-\s]?v\s*图|ideal gas|isothermal|isobaric|isochoric).{0,220}(状态方程|压强|体积|温度|p\s*v|nrt|state equation|pressure|volume|temperature)|(?:状态方程|压强|体积|温度|p\s*v|nrt|pressure|volume|temperature).{0,220}(理想气体|等温|等压|等容|p[-\s]?v图|p[-\s]?v\s*图|ideal gas|isothermal|isobaric|isochoric)/i.test(text)) return 'thermodynamics_ideal_gas_state_process';
  if (/(偏振片|偏振|马吕斯定律|透振方向|polarizer|polarization|malus).{0,220}(光强|夹角|cos²|自然光|透射|intensity|angle|natural light|transmitted)|(?:光强|夹角|cos²|自然光|透射|intensity|angle|natural light|transmitted).{0,220}(偏振片|偏振|马吕斯定律|透振方向|polarizer|polarization|malus)/i.test(text)) return 'optics_polarization_malus_law';
  if (/(双缝干涉|单缝衍射|缺级|中央亮纹|亮纹间距|暗纹|young|double slit|single slit|diffraction|interference).{0,220}(缝宽|缝间距|屏距|波长|级次|条纹|fringe|slit width|wavelength|order)|(?:缝宽|缝间距|屏距|波长|级次|条纹|fringe|slit width|wavelength|order).{0,220}(双缝干涉|单缝衍射|缺级|中央亮纹|亮纹间距|暗纹|young|double slit|single slit|diffraction|interference)/i.test(text)) return 'optics_interference_diffraction_pattern';
  if (/(衍射光栅|光栅方程|每毫米.*刻痕|grating|diffraction grating).{0,260}(主极大|级|波长|角间距|d\s*sin|d\s*\\sin|order|wavelength|angular separation)|(?:主极大|角间距|d\s*sin|d\s*\\sin|order|wavelength|angular separation).{0,260}(衍射光栅|光栅方程|grating|diffraction grating)/i.test(text)) return 'optics_diffraction_grating_order_angle';
  if (/(光本性|波动性|粒子性|光电效应|干涉|衍射|偏振|wave nature|particle nature).{0,180}(证据|证明|不能|现象|evidence|phenomenon)|(?:证据|证明|不能|现象|evidence|phenomenon).{0,180}(光本性|波动性|粒子性|光电效应|干涉|衍射|偏振|wave nature|particle nature)/i.test(text)) return 'optics_wave_particle_evidence_judgement';
  if (/(光电效应|爱因斯坦光电|截止频率|逸出功|遏止电压|光电子|photoelectric|work function|stopping voltage|threshold frequency).{0,220}(频率|光强|最大初动能|截止|逸出|电流|energy|frequency|intensity|current)|(?:频率|光强|最大初动能|截止|逸出|电流|energy|frequency|intensity|current).{0,220}(光电效应|爱因斯坦光电|photoelectric|work function|stopping voltage)/i.test(text)) return 'photoelectric_effect_threshold_energy';
  if (/(质量亏损|质能方程|核反应|核聚变|释放.*能量|mass defect|e\s*=\s*mc|nuclear reaction|fusion).{0,220}(mev|931\.5|u\s*=|氘核|氚核|氦核|中子|energy release)|(?:mev|931\.5|氘核|氚核|氦核|中子|energy release).{0,220}(质量亏损|质能方程|核反应|核聚变|mass defect|nuclear reaction|fusion)/i.test(text)) return 'nuclear_mass_defect_energy_release';
  if (/(α衰变|β衰变|γ衰变|alpha decay|beta decay|gamma decay|半衰期|half.?life|放射性|radioactive).{0,220}(质量数|原子序数|质子数|电荷数|减少|增加|不变|核子数|衰变|固有属性|mass number|atomic number)|(?:质量数|原子序数|质子数|电荷数|核子数|半衰期|mass number|atomic number).{0,220}(α衰变|β衰变|γ衰变|alpha decay|beta decay|gamma decay|放射性|radioactive)/i.test(text)) return 'nuclear_decay_alpha_beta_half_life_concept';
  if (/(电荷守恒|摩擦起电|静电感应|接触起电|charge conservation|electrostatic induction|charging by friction).{0,180}(转移|总量|守恒|创造|消灭|transfer|conserved|created|destroyed)|(?:转移|总量|守恒|创造|消灭|transfer|conserved).{0,180}(电荷守恒|摩擦起电|静电感应|charge conservation|electrostatic induction)/i.test(text)) return 'charge_conservation_electrostatic_induction_concept';
  if (/(库仑定律|coulomb).{0,180}(点电荷|电荷量|距离|平方|库仑力|force|charge|distance|r\^?2|r²)|(?:点电荷|电荷量|距离|平方|库仑力|force|charge|distance|r\^?2|r²).{0,180}(库仑定律|coulomb)/i.test(text)) return 'coulomb_law_direct_calculation';
  if (/(匀强电场|电场强度|电势差|uniform electric field|electric field strength|potential difference).{0,180}(e\s*=\s*u\s*\/\s*d|u\s*=\s*ed|距离|场强|电势差|distance|voltage)|(?:e\s*=\s*u\s*\/\s*d|u\s*=\s*ed|距离|场强|电势差|distance|voltage).{0,180}(匀强电场|电场强度|电势差|uniform electric field|electric field strength|potential difference)/i.test(text)) return 'uniform_electric_field_potential_relation';
  if (/(电场|电势|电势差|电场强度|静电力|electric field|potential|voltage).{0,180}(电荷|力|做功|势能|叠加|charge|force|work|potential energy|superposition)|(?:电荷|力|做功|势能|charge|force|work|potential energy).{0,180}(电场|电势|电势差|电场强度|electric field|potential|voltage)/i.test(text)) return 'electrostatics_field_potential_force';
  if (/(螺旋运动|螺距|v_∥|v\s*cos|helical motion|pitch).{0,220}(磁场|带电粒子|质子|周期|洛伦兹力|magnetic field|charged particle|period|lorentz)|(?:磁场|带电粒子|质子|周期|洛伦兹力|magnetic field|charged particle|period|lorentz).{0,220}(螺旋运动|螺距|v_∥|v\s*cos|helical motion|pitch)/i.test(text)) return 'magnetism_charged_particle_helical_motion';
  if (!/(带电粒子|质子|电子|电荷量|charged particle|proton|electron)/i.test(text) && /(安培力|通电导线|ampere force|current-carrying wire).{0,180}(b\s*i\s*l|f\s*=\s*bil|电流|长度|垂直|大小|current|length|perpendicular)|(?:b\s*i\s*l|f\s*=\s*bil|电流|长度|垂直|current|length|perpendicular).{0,180}(安培力|通电导线|ampere force|current-carrying wire)/i.test(text)) return 'ampere_force_direct_calculation';
  if (/(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle).{0,180}(半径|周期|圆周|速度选择器|方向|radius|period|circular|selector|direction)|(?:半径|周期|圆周|radius|period|circular).{0,180}(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle)/i.test(text)) return 'magnetism_lorentz_force_motion';
  if (/(电磁感应|磁通量|楞次定律|感应电动势|法拉第|electromagnetic induction|magnetic flux|lenz|faraday).{0,180}(方向|大小|变化率|线圈|导体棒|induced current|emf|coil|rod)|(?:方向|大小|变化率|线圈|导体棒|induced current|emf|coil|rod).{0,180}(电磁感应|磁通量|楞次定律|感应电动势|法拉第|electromagnetic induction|magnetic flux|lenz|faraday)/i.test(text)) return 'electromagnetic_induction_flux_lenz';
  if (/(平均速度|平均速率|average velocity|average speed).{0,180}(往返|返回|全程|位移|路程|displacement|distance)|(?:往返|返回|全程|位移|路程|displacement|distance).{0,180}(平均速度|平均速率|average velocity|average speed)/i.test(text)) return 'kinematics_displacement_velocity_scalar_vector_concept';
  if (!/(机械波|简谐横波|波形|波峰|波谷|振动|wave|crest|trough|phase)/i.test(text) && /(位移|路程|速度|速率|平均速度|平均速率|displacement|distance|velocity|speed).{0,180}(矢量|标量|大小|方向|初位置|末位置|vector|scalar|magnitude|direction|initial|final)|(?:矢量|标量|大小|方向|初位置|末位置|vector|scalar|magnitude|direction).{0,180}(位移|路程|速度|速率|平均速度|平均速率|displacement|distance|velocity|speed)/i.test(text)) return 'kinematics_displacement_velocity_scalar_vector_concept';
  if (!/(平抛|斜抛|projectile)/i.test(text) && /(匀变速|匀加速|constant acceleration|初速度|末速度|加速度).{0,180}(位移|时间|速度|v\s*=|s\s*=|x\s*=|直接代入|formula)|(?:位移|时间|速度|v\s*=|s\s*=|x\s*=).{0,180}(匀变速|匀加速|constant acceleration|加速度)/i.test(text)) return 'kinematics_constant_acceleration_direct';
  if (/(v[-\s]?t|s[-\s]?t|x[-\s]?t|a[-\s]?t|速度[-\s]?时间|位移[-\s]?时间|加速度[-\s]?时间|运动图像|motion graph).{0,220}(斜率|面积|交点|图像|graph|slope|area|intersection)|(?:斜率|面积|交点|slope|area|intersection).{0,220}(v[-\s]?t|s[-\s]?t|x[-\s]?t|a[-\s]?t|速度[-\s]?时间|位移[-\s]?时间|加速度[-\s]?时间|运动图像|motion graph)/i.test(text)) return 'kinematics_motion_graph_interpretation';
  if (/(平抛|斜抛|projectile).{0,180}(水平|竖直|分解|射程|飞行时间|component|range|time of flight)|(?:水平|竖直|component|range|time of flight).{0,180}(平抛|斜抛|projectile)/i.test(text)) return 'projectile_motion_component_solve';
  if (/(相对运动|相对速度|参考系|relative motion|relative velocity|frame of reference).{0,180}(速度|方向|追及|相遇|current|river)|(?:追及|相遇|河流|船|current|river).{0,180}(相对速度|参考系|relative velocity|frame)/i.test(text)) return 'relative_motion_frame_transform';
  if (/(受力分析|力的平衡|静力平衡|free.?body|force diagram|equilibrium).{0,180}(支持力|拉力|摩擦力|重力|normal force|tension|friction)|(?:支持力|拉力|摩擦力|重力|normal force|tension|friction).{0,180}(受力分析|力的平衡|静力平衡|free.?body|force diagram)/i.test(text)) return 'newton_force_equilibrium_diagram';
  if (/(作用力.*反作用力|反作用力|相互作用力|平衡力|牛顿第三定律|action.?reaction|third law).{0,180}(支持力|压力|重力|桌面|书|同一物体|不同物体|normal force|weight)|(?:支持力|压力|重力|桌面|书|同一物体|不同物体|normal force|weight).{0,180}(作用力.*反作用力|反作用力|相互作用力|平衡力|牛顿第三定律|action.?reaction|third law)/i.test(text)) return 'newton_action_reaction_balance_concept';
  if (/(静摩擦|最大静摩擦|动摩擦|滑动摩擦|摩擦因数|μs|μ_s|μk|μ_k|static friction|kinetic friction).{0,220}(开始滑动|保持静止|逐渐增大|水平拉力|滑动后|最大值|starts sliding)|(?:开始滑动|保持静止|逐渐增大|水平拉力|滑动后|最大值|starts sliding).{0,220}(静摩擦|最大静摩擦|动摩擦|滑动摩擦|摩擦因数|μs|μ_s|μk|μ_k|static friction|kinetic friction)/i.test(text)) return 'newton_static_kinetic_friction_transition';
  if (/(斜面|inclined plane).{0,180}(摩擦|加速度|临界|动摩擦因数|friction|acceleration|critical)|(?:摩擦|加速度|临界|friction|acceleration|critical).{0,180}(斜面|inclined plane)/i.test(text)) return 'newton_inclined_plane_friction';
  if (/(滑轮|绳|连接体|两物体|pulley|string|connected bodies).{0,180}(张力|加速度|整体法|隔离法|tension|acceleration)|(?:张力|tension).{0,180}(滑轮|绳|连接体|pulley|string|connected bodies)/i.test(text)) return 'newton_connected_bodies_tension';
  if (!/(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle)/i.test(text) && /(圆周运动|向心力|向心加速度|centripetal|circular motion).{0,180}(速度|半径|周期|临界|轨道|radius|period|critical)|(?:速度|半径|周期|临界|radius|period|critical).{0,180}(圆周运动|向心力|centripetal|circular motion)/i.test(text)) return 'circular_motion_centripetal_force';
  if (/(机械能守恒|动能定理|work[-\s]?energy|energy conservation|kinetic energy).{0,180}(高度|速度|弹簧|重力势能|做功|height|speed|spring|work)|(?:高度|速度|弹簧|重力势能|做功|height|speed|spring|work).{0,180}(机械能守恒|动能定理|work[-\s]?energy|energy conservation|kinetic energy)/i.test(text)) return 'work_energy_conservation';
  if (/(摩擦|阻力|非保守力|效率|功率|friction|resistance|nonconservative|efficiency|power).{0,180}(能量损失|机械能|做功|work|energy loss)|(?:能量损失|机械能|energy loss).{0,180}(摩擦|阻力|非保守力|效率|功率|friction|resistance|nonconservative|efficiency|power)/i.test(text)) return 'work_energy_nonconservative_loss';
  if (!/(一维碰撞|二维碰撞|弹性碰撞|非弹性碰撞)/i.test(text) && /(冲量|动量守恒|动量定理|impulse|momentum conservation).{0,180}(碰撞|爆炸|反冲|速度|collision|explosion|recoil)|(?:碰撞|爆炸|反冲|collision|explosion|recoil).{0,180}(冲量|动量|impulse|momentum)/i.test(text)) return 'momentum_impulse_conservation';
  if (/(一维碰撞|二维碰撞|弹性碰撞|非弹性碰撞|collision).{0,180}(动量|能量|分解|矢量|momentum|energy|component|vector)|(?:动量|momentum).{0,180}(一维|二维|弹性|非弹性|collision)/i.test(text)) return 'momentum_collision_1d_2d';
  if (/(电路|电阻|欧姆定律|基尔霍夫|串联|并联|circuit|resistor|ohm|kirchhoff|series|parallel).{0,220}(电流|电压|等效电阻|支路|current|voltage|equivalent resistance|branch)|(?:电流|电压|等效电阻|current|voltage|equivalent resistance).{0,220}(电路|电阻|欧姆定律|基尔霍夫|串联|并联|circuit|resistor|ohm|kirchhoff|series|parallel)/i.test(text)) return 'circuit_ohm_kirchhoff_resistor_network';
  if (/(电源内阻|内阻|输出功率|电功率|效率|internal resistance|output power|electric power|efficiency).{0,180}(电路|电源|负载|电阻|circuit|source|load|resistor)|(?:电路|电源|负载|电阻|circuit|source|load|resistor).{0,180}(电源内阻|内阻|输出功率|电功率|效率|internal resistance|output power|electric power|efficiency)/i.test(text)) return 'circuit_power_internal_resistance';
  if (/(简谐振动|振幅|周期|频率|平衡位置|simple harmonic motion|amplitude|period).{0,180}(最大位移|回复力|速度|加速度|定义|maximum displacement|restoring force|velocity|acceleration)|(?:最大位移|回复力|速度|加速度|定义|maximum displacement|restoring force|velocity|acceleration).{0,180}(简谐振动|振幅|周期|频率|平衡位置|simple harmonic motion|amplitude|period)/i.test(text)) return 'simple_harmonic_motion_basic_quantity';
  if (/(波动方程|初相|y\s*=|wave equation|initial phase).{0,220}(代入|求.*位移|t\s*=|x\s*=|波速|频率|calculate displacement|substitute)|(?:t\s*=|x\s*=|求.*位移|calculate displacement).{0,220}(波动方程|初相|振幅|波速|频率|wave equation|initial phase|amplitude)/i.test(text)) return 'mechanical_wave_equation_phase_calculation';
  if (/(简谐横波|机械波|波形|波峰|波谷|平衡位置|相位|simple harmonic wave|waveform|crest|trough|phase).{0,220}(振动速度|速度方向|位移|λ\/4|半个波长|相距|斜率|velocity direction|displacement|quarter wavelength|half wavelength|slope)|(?:振动速度|速度方向|位移|λ\/4|半个波长|相距|斜率|velocity direction|displacement|quarter wavelength|half wavelength|slope).{0,220}(简谐横波|机械波|波形|波峰|波谷|平衡位置|相位|simple harmonic wave|waveform|crest|trough|phase)/i.test(text)) return 'mechanical_wave_phase_state_judgement';
  if (!/(干涉|折射|透镜|成像|光|optics|lens|refraction|interference)/i.test(text) && /(波速|频率|波长|机械波|横波|纵波|wave speed|frequency|wavelength|mechanical wave|transverse wave|longitudinal wave).{0,180}(v\s*=\s*λ?\s*f|关系|介质|振源|传播方向|振动方向|relation|medium|source|direction)|(?:关系|介质|振源|传播方向|振动方向|relation|medium|source|direction).{0,180}(波速|频率|波长|机械波|横波|纵波|wave speed|frequency|wavelength|mechanical wave)/i.test(text)) return 'mechanical_wave_basic_relation';
  if (/(波速|频率|波长|干涉|折射|透镜|成像|wave speed|frequency|wavelength|interference|refraction|lens).{0,180}(周期|条纹|入射角|像距|焦距|变化|period|fringe|angle|image distance|focal length|change)|(?:周期|条纹|入射角|像距|焦距|变化|period|fringe|angle|image distance|focal length|change).{0,180}(波速|频率|波长|干涉|折射|透镜|成像|wave speed|frequency|wavelength|interference|refraction|lens)/i.test(text)) return 'waves_optics_interference_refraction';
  if (/(实验|探究|测量|experiment|measurement).{0,220}(图像|斜率|截距|拟合|slope|intercept|fit)|(?:图像|斜率|截距|拟合|slope|intercept|fit).{0,220}(实验|探究|测量|experiment|measurement)/i.test(text)) return 'experiment_graph_slope_intercept';
  if (/(误差|不确定度|有效数字|读数|游标|螺旋测微器|uncertainty|significant figures|reading|vernier|micrometer).{0,180}(测量|仪器|刻度|结果|measurement|instrument|scale|result)|(?:测量|仪器|刻度|measurement|instrument|scale).{0,180}(误差|不确定度|有效数字|读数|游标|螺旋测微器|uncertainty|significant figures|reading|vernier|micrometer)/i.test(text)) return 'measurement_uncertainty_significant_figures';
  return 'other';
}

type SubjectPracticeTaskFamilyClassifierInput = {
  subject?: string | null;
  topicTitle?: string | null;
  prompt?: string | null;
  explanation?: string | null;
  options?: unknown;
};

function subjectPracticeClassifyTaskFamilyRaw(input: SubjectPracticeTaskFamilyClassifierInput) {
  const promptText = cleanPolicyText(input.prompt).toLowerCase();
  const text = cleanPolicyText(`${promptText} ${optionText(input.options)} ${cleanPolicyText(input.explanation)}`).toLowerCase();
  const optionRows = Array.isArray(input.options) ? input.options : [];
  const singlePropertyOptionSet = optionRows.length >= 2 && optionRows.every((option) => (
    /(定义域|值域|单调|函数值|domain|range|monotonic|value)/i.test(cleanPolicyText(
      option && typeof option === 'object' ? (option as Record<string, unknown>).text : option
    ))
  ));
  if (!text) return '';
  const subject = cleanPolicyText(input.subject).toLowerCase();
  if (subject === 'physics') return subjectPracticeClassifyPhysicsTaskFamilyText(text);
  if (subject !== 'chemistry') {
  if (/(等差数列|arithmetic sequence)/i.test(text) && /(?:s[₀-₉0-9]+|前\s*n\s*项和|前n项和|a[₀-₉0-9]+\s*[+＋]|公差|\bd\b|首项|求.*a[₀-₉0-9]+)/i.test(text)) return 'arithmetic_sequence_two_condition_solve_a1_d';
  if (/(等比数列|geometric sequence)/i.test(text) && /(?:s[₀-₉0-9]+|前\s*n\s*项和|前n项和|a[₀-₉0-9]+|公比|\bq\b|求.*a[₀-₉0-9]+)/i.test(text)) return 'geometric_sequence_two_condition_solve_q';
  if (/(全集|universal set).{0,180}(?:元素个数|有\s*\d+\s*个元素|小于\s*\d+\s*的正整数|finite)|(?:元素个数|补集|complement).{0,180}(?:全集|universal set)/i.test(text)
    && /(补集|complement|∁|\\complement)/i.test(text)
    && /(元素个数|cardinality|number of elements|有多少个元素)/i.test(text)
    && !/(u\s*=\s*r|全集\s*u\s*=\s*r|实数集|区间|interval|x²|x\^2|不等式|inequality)/i.test(text)) return 'finite_set_cardinality_complement';
  if (/(全集|集合|set).{0,220}(区间|并集|交集|补集|描述法|x²|x\^2|不等式|interval|union|intersection)|(?:区间|并集|交集|补集|描述法|interval|union|intersection).{0,220}(全集|集合|set)/i.test(text)) return 'interval_set_operation_solution';
  if (/(平均数|mean|average).{0,120}(去掉|删除|剩余|removed|remaining)|(?:去掉|删除|剩余|removed|remaining).{0,120}(平均数|mean|average)/i.test(text)) return 'mean_removed_value';
  if (/(合并|两组|combined|pooled).{0,160}(方差|variance|平均数|mean)|(?:方差|variance).{0,160}(合并|两组|combined|pooled)/i.test(text)) return 'combined_variance';
  if (/(总体方差|样本方差|方差|variance).{0,160}(均值|平均数|离差平方|平方和|n\s*-?\s*1|自由度|dataset|data set)|(?:均值|平均数|离差平方|平方和|n\s*-?\s*1|自由度).{0,160}(总体方差|样本方差|方差|variance)/i.test(text)) return 'direct_variance_formula';
  if (/(长方体|cuboid|rectangular prism).{0,180}(对角线|体积|相对.*顶点|opposite vertex|diagonal|volume)|(?:空间直角坐标系|space coordinate|3d coordinate).{0,180}(对称点|关于.*(?:坐标平面|xoy|xoz|yoz|x轴|y轴|z轴)|相对.*顶点|长方体.*体积|coordinate symmetry|opposite vertex)/i.test(text)) return 'spatial_coordinate_direct_metric';
  if (/(点到平面|distance from .* point .* plane|point .* distance .* plane|法向量|normal vector).{0,180}(距离|平面|plane)|(?:平面|plane).{0,180}(点到平面|法向量|normal vector|原点|点\s*o|o\s*\().{0,100}(距离|distance)|(?:原点|点\s*o|o\s*\().{0,160}(平面|plane).{0,100}(距离|distance)/i.test(text)) return 'coordinate_geometry_point_to_plane_distance';
  if (/(圆|circle).{0,180}(直线|line).{0,180}(弦长|chord length)|(?:直线|line).{0,180}(圆|circle).{0,180}(弦长|chord length)|(?:弦长|chord length).{0,180}(圆心到直线距离|distance from .*center.*line|半径|radius)/i.test(text)) return 'circle_line_chord_length';
  if (/(椭圆|双曲线|抛物线|圆锥曲线|ellipse|hyperbola|parabola|conic).{0,180}(共焦点|焦点|focus|foci|直角三角形|离心率|渐近线|准线|参数|标准方程|asymptote|eccentricity|directrix|parameter)|(?:共焦点|焦点|focus|foci|渐近线|asymptote|离心率|eccentricity).{0,180}(椭圆|双曲线|抛物线|圆锥曲线|ellipse|hyperbola|parabola|conic)/i.test(text)) return 'conic_shared_focus_relation';
  if (/(空间|立体几何|space geometry|solid geometry|space).{0,180}(向量|\\vec|vector|点积|数量积|夹角|余弦|cos)|(?:向量|\\vec|vector|点积|数量积|夹角|余弦|cos).{0,180}(空间|立体几何|space geometry|solid geometry|space)|(?:[a-z]{1,2}|[A-Z]{1,2}).{0,20}(?:与|and).{0,20}(?:[a-z]{1,2}|[A-Z]{1,2}).{0,120}(夹角|余弦|cos)/i.test(text)) return 'spatial_vector_angle_cosine';
  if (/(空间|立体几何|space geometry|solid geometry).{0,180}(直线|线|平面|面).{0,180}(平行|垂直|命题|判断|parallel|perpendicular)|(?:直线|线|平面|面).{0,180}(平行|垂直|parallel|perpendicular).{0,180}(命题|判断|正确|incorrect)/i.test(text)) return 'spatial_line_plane_concept_judgement';
  if (
    /(指数|对数|幂|log|lg|exponential|logarithm).{0,180}(比较|大小|大小关系|排序|由小到大|由大到小|order)|(?:比较|大小|大小关系|排序|由小到大|由大到小|order).{0,180}(指数|对数|幂|log|lg|exponential|logarithm)/i.test(text)
    || (/(指数|对数|幂|log|lg|exponential|logarithm)/i.test(text) && /\b[a-d]\s*[<＞>]\s*[a-d]\s*[<＞>]\s*[a-d]\b/i.test(optionText(input.options)))
  ) return 'elementary_function_exp_log_ordering';
  if (
    /(?:f\s*\(\s*x\s*\)\s*=|y\s*=).{0,100}(?:log|lg|ln|对数|\^\s*x|x\s*\^|指数|幂|sqrt|\\sqrt|√|根式|根号)/i.test(promptText)
    && (/(定义域|值域|单调|函数值|domain|range|monotonic|value)/i.test(promptText) || singlePropertyOptionSet)
    && !/(方程|解得|求\s*x|x\s*的值|equation|solve)/i.test(promptText)
    && !/(二次函数|quadratic|x\s*\^\s*2|x²)/i.test(promptText)
  ) return 'elementary_function_direct_property';
  if (/(log|lg|ln|对数).{0,180}(方程|定义域|解得|x\s*的值|x\\?\)?\s*=|equation|domain|solve)|(?:方程|定义域|解得|x\s*的值|equation|domain|solve).{0,180}(log|lg|ln|对数)/i.test(text)) return 'logarithmic_equation_domain_solution';
  if (!/(二次函数|quadratic|对称轴|开口|顶点|axis|vertex)/i.test(text) && /(x\^y\s*=\s*y\^x|ln\s*t\s*\/\s*t|\\ln|单调性|monotonicity).{0,180}(当且仅当|奇偶|命题|判断|statement)|(?:函数|function).{0,180}(奇偶|偶函数|奇函数|单调|定义域|值域|命题|判断|parity|monotonicity)/i.test(text)) return 'function_monotonicity_parity_statement';
  if (/(不等式|inequality).{0,220}(一定成立|恒成立|命题|正确|错误|反例|保号|同向|反向|倒数|counterexample|a\s*>|b\s*>|c\s*>|d\s*>)|(?:一定成立|恒成立|命题|正确|错误|反例|保号|同向|反向|倒数|counterexample).{0,220}(不等式|inequality|a\s*>|b\s*>|c\s*>|d\s*>)/i.test(text)) return 'inequality_order_property_counterexample';
  if (/(导数|derivative|f'\(|切线|tangent).{0,180}(交点|约束|参数|斜率|constraint|slope)|(?:交点|约束|参数|斜率|constraint|slope).{0,180}(导数|derivative|f'\(|切线|tangent)/i.test(text)) return 'derivative_tangent_constraint';
  if (/(导数|derivative|f'\(|求导|可导).{0,180}(f'\s*\(|lim|极限|代入|evaluate|value)|(?:lim|极限|代入|evaluate|value).{0,180}(导数|derivative|f'\(|可导)/i.test(text)) return 'derivative_direct_evaluation';
  if (/(二次函数|quadratic).{0,180}(对称轴|开口|顶点|最小值|最大值|单调|值域|性质|axis|vertex)|(?:对称轴|开口|顶点|最小值|最大值|axis|vertex).{0,180}(二次函数|quadratic|x\^2|x²)|(?:x\^2|x²).{0,120}(对称轴|开口|顶点|axis|vertex)/i.test(text)) return 'quadratic_function_properties';
  if (/(概率|probability|事件|event|随机|抽取|取法).{0,180}(至少|至多|恰好|排列|组合|计数|互斥|独立|不考虑顺序|构成.*(?:等比数列|等差数列)|counting|combination)|(?:排列|组合|计数|不考虑顺序|构成.*(?:等比数列|等差数列)|counting|combination).{0,180}(概率|probability|事件|event|随机|抽取|取法)/i.test(text)) return 'probability_multi_event_counting';
  if (/(正态分布|标准正态|normal distribution|standard normal|φ|Φ|z\s*[=＝]|z分数).{0,220}(均值|平均|标准差|σ|sigma|概率|p\(|区间|百分位|分位|quantile|percentile)|(?:均值|平均|标准差|σ|sigma|概率|p\(|区间|百分位|分位|quantile|percentile).{0,220}(正态分布|标准正态|normal distribution|standard normal|φ|Φ|z\s*[=＝]|z分数)/i.test(text)) return 'normal_distribution_z_score_probability';
  if (/(复数|complex).{0,180}(共轭|四则运算|实部|虚部|overline|conjugate|real part|imaginary part)|(?:共轭|四则运算|实部|虚部|overline|conjugate|real part|imaginary part).{0,180}(复数|complex)/i.test(text)) return 'complex_conjugate_linear_equation_solve';
  if (/(复数|complex).{0,180}(模长|模|向量|数量积|dot product)/i.test(text)) return 'complex_mod_vector_dot_product';
  if (/(向量|\\vec|vector).{0,180}(坐标|数量积|点积|夹角|模长|求\||cos|norm|dot)|(?:坐标|数量积|点积|夹角|模长|求\||cos|norm|dot).{0,180}(向量|\\vec|vector)/i.test(text)) return 'vector_coordinate_norm_dot_angle';
  if (/(分式不等式|不等式|inequality).{0,180}(解集|区间|分母|端点|solution set)|(?:解集|区间|solution set).{0,180}(分式不等式|不等式|inequality)/i.test(text)) return 'rational_inequality_solution_boundary';
  }
  if (subject === 'math') return 'other';
  if (!subject) {
  if (!/(平抛|斜抛|projectile)/i.test(text) && /(匀变速|匀加速|constant acceleration|初速度|末速度|加速度).{0,180}(位移|时间|速度|v\s*=|s\s*=|x\s*=|直接代入|formula)|(?:位移|时间|速度|v\s*=|s\s*=|x\s*=).{0,180}(匀变速|匀加速|constant acceleration|加速度)/i.test(text)) return 'kinematics_constant_acceleration_direct';
  if (/(v[-\s]?t|s[-\s]?t|x[-\s]?t|a[-\s]?t|速度[-\s]?时间|位移[-\s]?时间|加速度[-\s]?时间|运动图像|motion graph).{0,220}(斜率|面积|交点|图像|graph|slope|area|intersection)|(?:斜率|面积|交点|slope|area|intersection).{0,220}(v[-\s]?t|s[-\s]?t|x[-\s]?t|a[-\s]?t|速度[-\s]?时间|位移[-\s]?时间|加速度[-\s]?时间|运动图像|motion graph)/i.test(text)) return 'kinematics_motion_graph_interpretation';
  if (/(平抛|斜抛|projectile).{0,180}(水平|竖直|分解|射程|飞行时间|component|range|time of flight)|(?:水平|竖直|component|range|time of flight).{0,180}(平抛|斜抛|projectile)/i.test(text)) return 'projectile_motion_component_solve';
  if (/(相对运动|相对速度|参考系|relative motion|relative velocity|frame of reference).{0,180}(速度|方向|追及|相遇|current|river)|(?:追及|相遇|河流|船|current|river).{0,180}(相对速度|参考系|relative velocity|frame)/i.test(text)) return 'relative_motion_frame_transform';
  if (/(受力分析|力的平衡|静力平衡|free.?body|force diagram|equilibrium).{0,180}(支持力|拉力|摩擦力|重力|normal force|tension|friction)|(?:支持力|拉力|摩擦力|重力|normal force|tension|friction).{0,180}(受力分析|力的平衡|静力平衡|free.?body|force diagram)/i.test(text)) return 'newton_force_equilibrium_diagram';
  if (/(斜面|inclined plane).{0,180}(摩擦|加速度|临界|动摩擦因数|friction|acceleration|critical)|(?:摩擦|加速度|临界|friction|acceleration|critical).{0,180}(斜面|inclined plane)/i.test(text)) return 'newton_inclined_plane_friction';
  if (/(滑轮|绳|连接体|两物体|pulley|string|connected bodies).{0,180}(张力|加速度|整体法|隔离法|tension|acceleration)|(?:张力|tension).{0,180}(滑轮|绳|连接体|pulley|string|connected bodies)/i.test(text)) return 'newton_connected_bodies_tension';
  if (!/(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle)/i.test(text) && /(圆周运动|向心力|向心加速度|centripetal|circular motion).{0,180}(速度|半径|周期|临界|轨道|radius|period|critical)|(?:速度|半径|周期|临界|radius|period|critical).{0,180}(圆周运动|向心力|centripetal|circular motion)/i.test(text)) return 'circular_motion_centripetal_force';
  if (/(机械能守恒|动能定理|work[-\s]?energy|energy conservation|kinetic energy).{0,180}(高度|速度|弹簧|重力势能|做功|height|speed|spring|work)|(?:高度|速度|弹簧|重力势能|做功|height|speed|spring|work).{0,180}(机械能守恒|动能定理|work[-\s]?energy|energy conservation|kinetic energy)/i.test(text)) return 'work_energy_conservation';
  if (/(摩擦|阻力|非保守力|效率|功率|friction|resistance|nonconservative|efficiency|power).{0,180}(能量损失|机械能|做功|work|energy loss)|(?:能量损失|机械能|energy loss).{0,180}(摩擦|阻力|非保守力|效率|功率|friction|resistance|nonconservative|efficiency|power)/i.test(text)) return 'work_energy_nonconservative_loss';
  if (!/(一维碰撞|二维碰撞|弹性碰撞|非弹性碰撞)/i.test(text) && /(冲量|动量守恒|动量定理|impulse|momentum conservation).{0,180}(碰撞|爆炸|反冲|速度|collision|explosion|recoil)|(?:碰撞|爆炸|反冲|collision|explosion|recoil).{0,180}(冲量|动量|impulse|momentum)/i.test(text)) return 'momentum_impulse_conservation';
  if (/(一维碰撞|二维碰撞|弹性碰撞|非弹性碰撞|collision).{0,180}(动量|能量|分解|矢量|momentum|energy|component|vector)|(?:动量|momentum).{0,180}(一维|二维|弹性|非弹性|collision)/i.test(text)) return 'momentum_collision_1d_2d';
  if (/(电路|电阻|欧姆定律|基尔霍夫|串联|并联|circuit|resistor|ohm|kirchhoff|series|parallel).{0,220}(电流|电压|等效电阻|支路|current|voltage|equivalent resistance|branch)|(?:电流|电压|等效电阻|current|voltage|equivalent resistance).{0,220}(电路|电阻|欧姆定律|基尔霍夫|串联|并联|circuit|resistor|ohm|kirchhoff|series|parallel)/i.test(text)) return 'circuit_ohm_kirchhoff_resistor_network';
  if (/(电源内阻|内阻|输出功率|电功率|效率|internal resistance|output power|electric power|efficiency).{0,180}(电路|电源|负载|电阻|circuit|source|load|resistor)|(?:电路|电源|负载|电阻|circuit|source|load|resistor).{0,180}(电源内阻|内阻|输出功率|电功率|效率|internal resistance|output power|electric power|efficiency)/i.test(text)) return 'circuit_power_internal_resistance';
  if (/(电场|电势|电势差|电场强度|静电力|electric field|potential|voltage).{0,180}(电荷|力|做功|势能|叠加|charge|force|work|potential energy|superposition)|(?:电荷|力|做功|势能|charge|force|work|potential energy).{0,180}(电场|电势|电势差|电场强度|electric field|potential|voltage)/i.test(text)) return 'electrostatics_field_potential_force';
  if (/(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle).{0,180}(半径|周期|圆周|速度选择器|方向|radius|period|circular|selector|direction)|(?:半径|周期|圆周|radius|period|circular).{0,180}(洛伦兹力|磁场|带电粒子|lorentz|magnetic field|charged particle)/i.test(text)) return 'magnetism_lorentz_force_motion';
  if (/(电磁感应|磁通量|楞次定律|感应电动势|法拉第|electromagnetic induction|magnetic flux|lenz|faraday).{0,180}(方向|大小|变化率|线圈|导体棒|induced current|emf|coil|rod)|(?:方向|大小|变化率|线圈|导体棒|induced current|emf|coil|rod).{0,180}(电磁感应|磁通量|楞次定律|感应电动势|法拉第|electromagnetic induction|magnetic flux|lenz|faraday)/i.test(text)) return 'electromagnetic_induction_flux_lenz';
  if (/(波速|频率|波长|干涉|折射|透镜|成像|wave speed|frequency|wavelength|interference|refraction|lens).{0,180}(周期|条纹|入射角|像距|焦距|变化|period|fringe|angle|image distance|focal length|change)|(?:周期|条纹|入射角|像距|焦距|变化|period|fringe|angle|image distance|focal length|change).{0,180}(波速|频率|波长|干涉|折射|透镜|成像|wave speed|frequency|wavelength|interference|refraction|lens)/i.test(text)) return 'waves_optics_interference_refraction';
  if (/(实验|探究|测量|experiment|measurement).{0,220}(图像|斜率|截距|拟合|slope|intercept|fit)|(?:图像|斜率|截距|拟合|slope|intercept|fit).{0,220}(实验|探究|测量|experiment|measurement)/i.test(text)) return 'experiment_graph_slope_intercept';
  if (/(误差|不确定度|有效数字|读数|游标|螺旋测微器|uncertainty|significant figures|reading|vernier|micrometer).{0,180}(测量|仪器|刻度|结果|measurement|instrument|scale|result)|(?:测量|仪器|刻度|measurement|instrument|scale).{0,180}(误差|不确定度|有效数字|读数|游标|螺旋测微器|uncertainty|significant figures|reading|vernier|micrometer)/i.test(text)) return 'measurement_uncertainty_significant_figures';
  }
  if (subject && subject !== 'chemistry') return 'other';
  const chemistryTopicDomain = subjectPracticeChemistryTopicDomain(input.topicTitle);
  if (
    chemistryTopicDomain === 'classification'
    && /(纯净物|混合物|单质|化合物|氧化物|酸|碱|盐|物质分类|物理变化|化学变化|新物质|组成|pure substance|mixture|element|compound|oxide|acid|base|salt|physical change|chemical change|new substance)/i.test(text)
    && /(生成|产生|形成|沉淀|气泡|变色|熔化|凝固|汽化|液化|升华|溶解|燃烧|锈蚀|分解|反应前|反应后|现象|证据|组成|produces?|forms?|precipitate|bubbles?|color change|melting|freezing|vaporization|condensation|sublimation|dissolv|burn|rust|decompos|before|after|observation|evidence|composition)/i.test(text)
  ) return 'classification_state_change_evidence_judgement';
  if (chemistryTopicDomain === 'gas_experiment') {
    if (
      /(cl2|cl₂|氯气)/i.test(text)
      && /(hcl|盐酸|氯化氢|水蒸气|饱和食盐水|浓硫酸|除杂|干燥|净化|purify|dry)/i.test(text)
      && /(湿润.*蓝色石蕊|蓝色石蕊|hclo|次氯酸|漂白|褪色|先变红|chlorine water|bleach)/i.test(text)
    ) return 'gas_chlorine_impurity_drying_litmus_bleaching';
    if (
      /(nh3|nh₃|氨气|氨)/i.test(text)
      && /(氯化铵|nh4cl|nh₄cl|氢氧化钙|ca\(oh\)2|ca\\?\(oh\\?\)2|向下排空气|红色石蕊|变蓝)/i.test(text)
      && /(制取|收集|检验|瓶口|湿润|identify|test|collection)/i.test(text)
    ) return 'gas_ammonia_preparation_red_litmus';
    if (
      /(h2|h₂|氢气)/i.test(text)
      && /(收集|向下排空气|排水法|验纯|爆鸣|噗|点燃前|collection|purity|pop sound)/i.test(text)
      && /(制取|实验室|锌|稀硫酸|稀盐酸|密度小|不易溶于水|检验纯度|纯度|火焰|混有空气|collection|test)/i.test(text)
    ) return 'gas_hydrogen_collection_purity_test';
    if (
      /(制取|收集|检验|气流|通入|通过|依次|preparation|collection|identify|test)/i.test(text)
      && /(o2|o₂|氧气|h2|h₂|氢气|cl2|cl₂|氯气|co2|co₂|二氧化碳|nh3|nh₃|氨气)/i.test(text)
      && /(杂质|混有|除去|吸收|干燥|净化|干扰|排除|依次通过|naoh|氢氧化钠|浓硫酸|饱和食盐水|purify|dry|impurity|interference)/i.test(text)
      && /(顺序|依次|其后|先.*后|不能互换|可互换|复燃|不变浑浊|合理|推断|competing|order)/i.test(text)
    ) return 'gas_impurity_control_competing_elimination';
    if (
      /(kmno4|高锰酸钾|加热.*(?:固体|试管)|试管口|导管|酒精灯|棉花|倒吸|水槽|冷凝水)/i.test(text)
      && /(o2|o₂|氧气)/i.test(text)
      && /(制取|收集|排水法|导管移出|熄灭酒精灯|试管口.*(?:下倾|向下)|棉花|倒吸|炸裂|气密性|实验操作)/i.test(text)
      && !/(杂质|混有|除去|净化|干扰|排除|依次通过|naoh|氢氧化钠|浓硫酸|澄清石灰水|不变浑浊)/i.test(text)
    ) return 'gas_oxygen_kmno4_preparation_operation';
    if (
      /(o2|o₂|氧气)/i.test(text)
      && /(向上排空气|排水法|收集|不易溶于水|密度.*空气|collection|water displacement)/i.test(text)
      && /(既能|也可|方法|下列气体|适合|collection method|collect)/i.test(text)
    ) return 'gas_oxygen_collection_method_selection';
    if (
      /(co2|co₂|二氧化碳)/i.test(text)
      && /(收集满|验满|集满|充满|逸出瓶口|瓶口|瓶口处|collected full|full collection)/i.test(text)
      && /(燃着.*木条|木条.*熄灭|火焰.*熄灭|熄灭|burning splint|extinguish)/i.test(text)
    ) return 'gas_carbon_dioxide_collection_full_splint';
    if (
      /(co2|co₂|二氧化碳)/i.test(text)
      && /(澄清石灰水|石灰水|ca\(oh\)2|ca\\?\(oh\\?\)2|caco3|caco₃|碳酸钙|limewater)/i.test(text)
      && /(检验|鉴别|证明|判断|是否为|变浑浊|白色沉淀|特征现象|identify|test|milky)/i.test(text)
    ) return 'gas_carbon_dioxide_limewater';
  }
  if (chemistryTopicDomain === 'notation') {
    const notationAmphotericHydroxideEquation = (
      /(al\s*\(\s*oh\s*\)\s*3|alo2-|alo₂-|偏铝酸|氢氧化铝|两性)/i.test(text)
      && /(过量.*(?:naoh|氢氧化钠|oh-)|继续滴加|沉淀.*溶解|溶解.*方程式|离子方程式)/i.test(text)
    ) || (
      /(白色固体|白色沉淀)/i.test(text)
      && /(过量稀盐酸|盐酸.*无气泡|无气泡)/i.test(text)
      && /(逐滴.*(?:naoh|氢氧化钠)|(?:naoh|氢氧化钠).*白色沉淀)/i.test(text)
      && /(继续滴加.*沉淀.*溶解|沉淀.*又.*溶解|沉淀完全溶解)/i.test(text)
      && /(方程式|离子方程式|正确表示)/i.test(text)
    );
    if (notationAmphotericHydroxideEquation) return 'notation_amphoteric_hydroxide_equation_selection';
    if (/(caco3|caco₃|碳酸钙|澄清石灰水|石灰水)/i.test(text)
      && /(co2|co₂|二氧化碳|持续通入|继续通入)/i.test(text)
      && /(沉淀.*消失|沉淀完全消失|hco3|hco₃|碳酸氢|离子方程式|方程式)/i.test(text)) return 'notation_carbonate_bicarbonate_equation_selection';
  }
  if (
    chemistryTopicDomain !== 'notation'
    &&
    /(na2co3|na₂co₃|碳酸钠|碳酸盐|盐酸|稀盐酸)/i.test(text)
    && /(逐滴|①|②|两操作|依次|顺序)/i.test(text)
    && /(过量|先无.*气泡|后产生气泡|立即产生气泡|气泡现象|nahco3|nahco₃|碳酸氢钠)/i.test(text)
  ) return 'inorganic_carbonate_acid_addition_order_gas_sequence';
  if (
    chemistryTopicDomain === 'redox'
    && /(氧化还原|电子|失去|得到|得电子|失电子|化合价|氧化剂|还原剂|被氧化|被还原|redox|oxidation|reduction|oxidized|reduced)/i.test(text)
    && /(→|->|=|反应)/i.test(text)
    && /(失去电子|得到电子|得电子|失电子|loses? electrons?|gains? electrons?)/i.test(text)
    && !/(mol|mmol|物质的量|体积|标准状况|22\.4|恰好|完全|足量|不足|限量|优先|先氧化|全部被氧化|全部被还原|既作|又作|歧化|归中|理论上|比值|之比|计算|排序|强弱|未知|推断|①|②|③|Ⅰ|Ⅱ|I\)|II\)|compare|rank|infer)/i.test(text)
  ) return 'basic_redox_single_species_judgement';
  if (
    chemistryTopicDomain === 'redox'
    && /(电子|e[-⁻]?|转移|氧化|还原|氧化剂|还原剂|失去|得到|升至|降至|化合价|cl2|cl₂|kmno4|mno4|fe2|fe²|fei2|febi2|pbo2|pbo₂)/i.test(text)
    && /(mol|物质的量|体积|l\b|ml|标准状况|22\.4|恰好|完全|足量|不足|限量|优先|先氧化|全部被氧化|理论上|比值|之比|计算)/i.test(text)
  ) return 'redox_electron_transfer_quantitative_chain';
  if (
    /(氧化还原|电子转移|化合价|氧化剂|还原剂|被氧化|被还原|redox|oxidizing agent|reducing agent)/i.test(text)
    && /(pb|pbo2|pbo₂|铅蓄电池|cl2|cl₂|hclo|fecl3|fecl₂|fecl2|cu|单反应|反应)/i.test(text)
    && /(升至|降至|价升|价降|0价|\+2价|\+4价|作氧化剂|作还原剂|oxidized|reduced)/i.test(text)
  ) return 'redox_single_reaction_valence_agent_judgement';
  if (chemistryTopicDomain === 'notation') {
    const notationAmphotericHydroxideEquation = (
      /(al\s*\(\s*oh\s*\)\s*3|alo2-|alo₂-|偏铝酸|氢氧化铝|两性)/i.test(text)
      && /(过量.*(?:naoh|氢氧化钠|oh-)|继续滴加|沉淀.*溶解|溶解.*方程式|离子方程式)/i.test(text)
    ) || (
      /(白色固体|白色沉淀)/i.test(text)
      && /(过量稀盐酸|盐酸.*无气泡|无气泡)/i.test(text)
      && /(逐滴.*(?:naoh|氢氧化钠)|(?:naoh|氢氧化钠).*白色沉淀)/i.test(text)
      && /(继续滴加.*沉淀.*溶解|沉淀.*又.*溶解|沉淀完全溶解)/i.test(text)
      && /(方程式|离子方程式|正确表示)/i.test(text)
    );
    if (notationAmphotericHydroxideEquation) return 'notation_amphoteric_hydroxide_equation_selection';
    if (/(caco3|caco₃|碳酸钙|澄清石灰水|石灰水)/i.test(text)
      && /(co2|co₂|二氧化碳|持续通入|继续通入)/i.test(text)
      && /(沉淀.*消失|沉淀完全消失|hco3|hco₃|碳酸氢|离子方程式|方程式)/i.test(text)) return 'notation_carbonate_bicarbonate_equation_selection';
  }
  if (
    (
      /(co2|co₂|二氧化碳)/i.test(text)
      && /(澄清石灰水|石灰水|ca\(oh\)2|ca\\?\(oh\\?\)2|caco3|caco₃|碳酸钙)/i.test(text)
    )
    || (
      /(na2co3|na₂co₃|碳酸钠)/i.test(text)
      && /(盐酸|稀盐酸|气泡|变浑浊|澄清石灰水)/i.test(text)
    )
  ) return 'inorganic_carbonate_acid_limewater_observation';
  const chemistryTopicAllowsInorganic = chemistryTopicDomain === 'inorganic' || /常见无机物|无机物性质|无机/.test(cleanPolicyText(input.topicTitle));
  if (chemistryTopicDomain === 'notation') {
    const amphotericHydroxideEquation = (
      /(al\s*\(\s*oh\s*\)\s*3|alo2-|alo₂-|偏铝酸|氢氧化铝|两性)/i.test(text)
      && /(过量.*(?:naoh|氢氧化钠|oh-)|继续滴加|沉淀.*溶解|溶解.*方程式|离子方程式)/i.test(text)
    ) || (
      /(白色固体|白色沉淀)/i.test(text)
      && /(过量稀盐酸|盐酸.*无气泡|无气泡)/i.test(text)
      && /(逐滴.*(?:naoh|氢氧化钠)|(?:naoh|氢氧化钠).*白色沉淀)/i.test(text)
      && /(继续滴加.*沉淀.*溶解|沉淀.*又.*溶解|沉淀完全溶解)/i.test(text)
      && /(方程式|离子方程式|正确表示)/i.test(text)
    );
    if (amphotericHydroxideEquation) return 'notation_amphoteric_hydroxide_equation_selection';
    if (/(caco3|caco₃|碳酸钙|澄清石灰水|石灰水)/i.test(text)
      && /(co2|co₂|二氧化碳|持续通入|继续通入)/i.test(text)
      && /(沉淀.*消失|沉淀完全消失|hco3|hco₃|碳酸氢|离子方程式|方程式)/i.test(text)) return 'notation_carbonate_bicarbonate_equation_selection';
    if (/(离子方程式|ionic equation).{0,220}(弱酸|弱碱|难溶|沉淀|气体|水|拆|保留|电荷守恒|weak acid|insoluble|precipitate|split|charge)|(?:弱酸|弱碱|难溶|沉淀|气体|水|拆|保留|电荷守恒|weak acid|insoluble|precipitate|split|charge).{0,220}(离子方程式|ionic equation)/i.test(text)) return 'notation_ionic_equation_species_splitting';
    if (/(浓硝酸|稀硝酸|浓硫酸|氧化还原|价态|无色气体|红棕色|黄绿色|so2|no2|no|cl2|redox).{0,260}(方程式|配平|equation|balance)|(?:方程式|配平|equation|balance).{0,260}(浓硝酸|稀硝酸|浓硫酸|氧化还原|价态|无色气体|红棕色|黄绿色|so2|no2|no|cl2|redox)/i.test(text)) return 'notation_redox_equation_multi_observation';
    if (/(未知|推断|现象|先.*后|逐滴|过量|溶解|变色|沉淀|气体|unknown|infer|observation).{0,260}(方程式|配平|equation|balance)|(?:方程式|配平|equation|balance).{0,260}(未知|推断|现象|先.*后|逐滴|过量|溶解|变色|沉淀|气体|unknown|infer|observation)/i.test(text)) return 'notation_balanced_equation_evidence_chain';
    if (/(化学式|分子式|formula|新生成的溶质|生成的盐).{0,220}(沉淀|气体|溶质|盐|观察|现象|precipitate|gas|solute|salt|observation)|(?:沉淀|气体|溶质|盐|观察|现象|precipitate|gas|solute|salt|observation).{0,220}(化学式|分子式|formula|新生成的溶质|生成的盐)/i.test(text)) return 'notation_formula_from_single_observation';
  }
  if (chemistryTopicDomain === 'equilibrium') {
    if (/(fe3\+|fe³\+|铁离子|scn[-⁻]|硫氰酸根|血红色|红色络合物)/i.test(text) && /(加热|热水浴|升温|温度|temperature|heated)/i.test(text) && /(颜色变浅|褪色|变浅|红色变浅|血红色变浅|color fades|paler)/i.test(text)) return 'equilibrium_temperature_color_shift';
    const controlledComparison = /(两支试管|两组|其他条件相同|唯一变量|control variable|all other conditions)/i.test(promptText);
    const temperatureFactor = /(温度|热水浴|冷水浴|加热|升温|℃|°c|temperature|heated|water bath)/i.test(promptText);
    const concentrationFactor = /(浓度|较浓|较稀|稀释|不同体积.*溶液|concentration|dilution)/i.test(promptText);
    const surfaceFactor = /(铁粉.{0,40}铁片|铁片.{0,40}铁粉|锌粉.{0,40}锌粒|锌粒.{0,40}锌粉|粉末|颗粒|表面积|接触面积|powder|particle|surface area)/i.test(promptText);
    const catalystFactor = /(催化剂|mno2|二氧化锰|catalyst)/i.test(promptText);
    const reactantNatureFactor = /(反应物本性|金属种类|镁片和铁片|物质本性|reactant nature)/i.test(promptText);
    const acidStrengthFactor = /(盐酸|hcl|醋酸|乙酸|ch3cooh|ch₃cooh|强酸|弱酸|酸性强弱|acid strength)/i.test(promptText);
    const sameAmountContext = /(相同|等浓度|等体积|等量|同温|其他条件相同|same concentration|same volume|same amount)/i.test(promptText);
    if (acidStrengthFactor && sameAmountContext && /(锌|zn|镁|mg|氢气|h2|h₂|气泡|反应速率|速率|rate)/i.test(text)) return 'reaction_rate_acid_strength_total_hydrogen_comparison';
    if (surfaceFactor && /(锌粉|锌粒|锌片|铁粉|铁片|粉末|颗粒)/i.test(promptText) && /(最终|总量|产生.*(?:氢气|气体).*相同|氢气.*(?:相同|不变)|same final|total product)/i.test(text)) return 'reaction_rate_surface_area_final_amount_constant';
    if (/(h2o2|h₂o₂|过氧化氢)/i.test(promptText) && concentrationFactor && /(收集|产生).{0,80}(o2|o₂|氧气|气体)|(?:o2|o₂|氧气|气体).{0,80}(收集|产生)/i.test(text) && /(时间|秒|s\b|min|rate|速率)/i.test(text)) return 'reaction_rate_concentration_time_to_same_product_amount';
    if (temperatureFactor && concentrationFactor && /(无法判断|不能判断|相互|分别有利|indeterminate|cannot determine)/i.test(text)) return 'reaction_rate_competing_factors_indeterminate';
    if (controlledComparison && catalystFactor) return 'reaction_rate_catalyst_controlled_comparison';
    if (controlledComparison && surfaceFactor) return 'reaction_rate_surface_area_controlled_comparison';
    if (controlledComparison && reactantNatureFactor) return 'reaction_rate_reactant_nature_controlled_comparison';
    if (controlledComparison && temperatureFactor) return 'reaction_rate_temperature_controlled_comparison';
    if (controlledComparison && concentrationFactor) return 'reaction_rate_concentration_controlled_comparison';
  }
  if (
    chemistryTopicDomain === 'organic'
    && /(完全燃烧|燃烧生成|co2|co₂|h2o|h₂o)/i.test(text)
    && /(溴水|br2|br₂|加成|不饱和|双键|三键)/i.test(text)
    && /(银氨|银镜|白色沉淀|端基炔|末端炔|c≡ch)/i.test(text)
  ) return 'organic_combustion_unsaturation_functional_group_inference';
  if (/(乙烯|乙醇|乙醛|乙酸|乙酸乙酯|甲酸酯|酯化|银镜|有机物|有机|官能团|醇|醛|羧酸|酯).{0,220}(转化|加成|氧化|燃烧|水解|银镜|生成|浓硫酸|加热|官能团|结构|反应类型|分子式)|(?:转化|加成|氧化|燃烧|水解|银镜|生成|浓硫酸|加热|官能团|结构|反应类型|分子式).{0,220}(乙烯|乙醇|乙醛|乙酸|乙酸乙酯|甲酸酯|酯化|银镜|有机物|有机|官能团|醇|醛|羧酸|酯)/i.test(text)) return 'organic_alcohol_aldehyde_acid_ester_conversion';
  if (chemistryTopicDomain === 'organic' && /(乙酸|羧酸|醋酸|acetic acid|carboxylic acid).{0,180}(石蕊|指示剂|酸性|变红|indicator|litmus|acidic)|(?:石蕊|指示剂|酸性|变红|indicator|litmus|acidic).{0,180}(乙酸|羧酸|醋酸|acetic acid|carboxylic acid)/i.test(text)) return 'organic_acid_indicator_discrimination';
  if (/(废液|废水|排水槽|分类收集|waste liquid|wastewater|drain).{0,220}(混合|混倒|气体|刺激性|有毒|危险|mix|gas|toxic|hazard)|(?:混合|混倒|气体|刺激性|有毒|危险|mix|gas|toxic|hazard).{0,220}(废液|废水|排水槽|分类收集|waste liquid|wastewater|drain)/i.test(text)) return 'lab_waste_mixing_hazard_evidence_chain';
  if (/(托盘天平|天平|砝码|游码|左盘|右盘|称量|balance|weigh).{0,220}(左物右码|右物左码|药品.*右盘|砝码.*左盘|放反|误将|实际质量|误差)|(?:左物右码|右物左码|药品.*右盘|砝码.*左盘|放反|误将|实际质量|误差).{0,220}(托盘天平|天平|砝码|游码|左盘|右盘|称量|balance|weigh)/i.test(text)) return 'lab_balance_pan_reversal_mass_error';
  if (/(蒸馏|冷凝管|冷凝水|支管口|温度计|沸石|馏分|distillation|condenser).{0,260}(下口进|上口出|接反|水银球|液面下|暴沸|补加沸石|馏分不纯|读数偏高|apparatus|boiling chip)|(?:下口进|上口出|接反|水银球|液面下|暴沸|补加沸石|馏分不纯|读数偏高|apparatus|boiling chip).{0,260}(蒸馏|冷凝管|冷凝水|支管口|温度计|沸石|馏分|distillation|condenser)/i.test(text)) return 'lab_distillation_apparatus_error_diagnosis';
  if (/(滴定|titration|终点|酚酞|甲基橙|锥形瓶|酸式滴定管|碱式滴定管).{0,260}(粉红|褪去|半分钟|读数|继续滴加|摇动|重新|准确|误差|endpoint|indicator|buret|burette)|(?:粉红|褪去|半分钟|读数|继续滴加|摇动|重新|准确|误差|endpoint|indicator|buret|burette).{0,260}(滴定|titration|终点|酚酞|甲基橙|锥形瓶|酸式滴定管|碱式滴定管)/i.test(text)) return 'lab_acid_base_titration_endpoint_correction';
  if (/(mgcl2|mgcl₂|氯化镁|cl-|cl⁻|氯离子).{0,220}(mol\/l|mol·l|mol·l|浓度|物质的量浓度|体积|溶液)|(?:mol\/l|mol·l|mol·l|浓度|物质的量浓度|体积|溶液).{0,220}(mgcl2|mgcl₂|氯化镁|cl-|cl⁻|氯离子)/i.test(text)) return 'electrolyte_solution_ion_concentration_calculation';
  const amphotericHydroxideEquation = (
    /(al\s*\(\s*oh\s*\)\s*3|alo2-|alo₂-|偏铝酸|氢氧化铝|两性)/i.test(text)
    && /(过量.*(?:naoh|氢氧化钠|oh-)|继续滴加|沉淀.*溶解|溶解.*方程式|离子方程式)/i.test(text)
  ) || (
    /(白色固体|白色沉淀)/i.test(text)
    && /(过量稀盐酸|盐酸.*无气泡|无气泡)/i.test(text)
    && /(逐滴.*(?:naoh|氢氧化钠)|(?:naoh|氢氧化钠).*白色沉淀)/i.test(text)
    && /(继续滴加.*沉淀.*溶解|沉淀.*又.*溶解|沉淀完全溶解)/i.test(text)
    && /(方程式|离子方程式|正确表示)/i.test(text)
  );
  if (amphotericHydroxideEquation) return 'notation_amphoteric_hydroxide_equation_selection';
  if (/(caco3|caco₃|碳酸钙|澄清石灰水|石灰水)/i.test(text)
    && /(co2|co₂|二氧化碳|持续通入|继续通入)/i.test(text)
    && /(沉淀.*消失|沉淀完全消失|hco3|hco₃|碳酸氢|离子方程式|方程式)/i.test(text)) return 'notation_carbonate_bicarbonate_equation_selection';
  if (/(试管|酒精灯|烧杯|量筒|石棉网|冷凝管).{0,220}(加热|预热|外焰|内焰|暴沸|炸裂|冷凝水|水珠|受热不均|倒流|喷出|裂|安全)|(?:加热|预热|外焰|内焰|暴沸|炸裂|冷凝水|水珠|受热不均|倒流|喷出|裂|安全).{0,220}(试管|酒精灯|烧杯|量筒|石棉网|冷凝管)/i.test(text)) return 'lab_heating_failure_cause_analysis';
  const labOperationKinds = new Set(promptText.match(/称量|量取|溶解|定容|洗涤|冲洗|稀释|加热|冷却|weigh|measure|dissolve|dilute|heat|cool/gi) ?? []);
  const hasMultipleLabOperations = labOperationKinds.size >= 2 || /(多个|多项|若干|依次|先.{0,60}再).{0,120}(操作|步骤|处理)/i.test(promptText);
  if (hasMultipleLabOperations && /(错误|不规范|原因|分析|改正|炸裂|发热|液面|error|cause|analyse|correct|crack)/i.test(promptText)) return 'lab_multi_operation_error_diagnosis';
  if (/(酒精灯|灯帽|浓硫酸|稀硫酸|闻.*气体|未知气体|试剂瓶|量筒|锥形瓶|集气瓶|漏斗|胶头滴管|滴管|仪器|实验室).{0,180}(正确操作|用途|安全|盖灭|吹灭|添加|倒入|搅拌|扇动|量取|滴加|垂直悬空|接触|平放|倒置|冲洗|专用|加热|收集)|(?:正确操作|用途|安全|盖灭|吹灭|添加|倒入|搅拌|扇动|量取|滴加|垂直悬空|接触|平放|倒置|冲洗|专用|加热|收集).{0,180}(酒精灯|灯帽|浓硫酸|稀硫酸|闻.*气体|未知气体|试剂瓶|量筒|锥形瓶|集气瓶|漏斗|胶头滴管|滴管|仪器|实验室)/i.test(text)) return 'lab_safety_operation_single_rule';
  const equilibriumLike = /恒温|恒容|恒压|充入|压缩|扩大容器|扩大为|体积|q\s*[<=>]|平衡常数|转化率|产率|可逆反应|⇌|equilibrium/.test(text);
  if (equilibriumLike) {
    const hasQk = /反应商|平衡常数|\bq\b|\bk\b|q\s*[<=>]|[<=>]\s*k/i.test(text);
    const hasCatalyst = /催化剂|catalyst/i.test(text);
    const hasVolume = /压缩|扩大容器|扩大为|体积.*(?:半|倍|减小|增大)|容积.*(?:不变|改变|扩大|压缩)|pressure|volume/i.test(text);
    const hasTemperature = /升温|降温|温度|t[₀-₉0-9]|Δh|吸热|放热|temperature|endothermic|exothermic/i.test(text);
    const hasConcentrationPerturbation = /再充入|加入.*(?:mol|浓度|少量)|移走|通入.*(?:反应物|生成物|so2|o2|co2|cl2|h2|i2)|concentration/i.test(text);
    if (/(fe3\+|fe³\+|铁离子|scn[-⁻]|硫氰酸根|血红色|红色络合物)/i.test(text) && /(加热|热水浴|升温|温度|temperature|heated)/i.test(text) && /(颜色变浅|褪色|变浅|红色变浅|血红色变浅|color fades|paler)/i.test(text)) return 'equilibrium_temperature_color_shift';
    if (hasTemperature && /(k[₀-₉0-9]?\s*[=＝]|平衡常数|升温|降温|t[₀-₉0-9])/.test(text)) return 'equilibrium_temperature_k_or_heat_shift';
    if (hasVolume && hasQk) return 'equilibrium_pressure_volume_shift';
    if (hasConcentrationPerturbation && hasQk) return 'equilibrium_concentration_qk_perturbation';
    if (hasCatalyst) return 'equilibrium_catalyst_rate_contrast';
  }
  if (/(侯氏制碱|联合制碱|氨碱法|制碱|饱和食盐水|母液|析出.*nh4cl|solvay|hou.*process).{0,220}(nh3|nh₃|氨|co2|co₂|nahco3|nahco₃|nh4cl|nh₄cl|碳酸氢钠|氯化铵|盐析|滤液)|(?:nh3|nh₃|氨|co2|co₂|nahco3|nahco₃|nh4cl|nh₄cl|碳酸氢钠|氯化铵|盐析|滤液).{0,220}(侯氏制碱|联合制碱|氨碱法|制碱|饱和食盐水|母液|solvay|hou.*process)/i.test(text)) return 'industrial_solvay_ammonia_soda_process';
  if (/(合成氨|合成塔|氨液化|循环气|未反应.*(?:n2|n₂|h2|h₂)|haber).{0,220}(转化率|体积|循环|分离|液氨|n2|n₂|h2|h₂|nh3|nh₃)|(?:转化率|体积|循环|分离|液氨|n2|n₂|h2|h₂|nh3|nh₃).{0,220}(合成氨|合成塔|氨液化|循环气|haber)/i.test(text)) return 'industrial_ammonia_synthesis_recycle_stoichiometry';
  if (
    /(氯碱|粗盐水|精制.*盐水|离子膜|电解槽)/i.test(text)
    && /(除.*(?:ca|钙|so4|so₄|硫酸根)|bacl2|bacl₂|na2co3|na₂co₃)/i.test(text)
    && /(顺序|过滤|过量|残留|结垢|损伤|除杂|沉淀)/i.test(text)
  ) return 'industrial_brine_purification_ordering';
  if (
    chemistryTopicDomain === 'periodic'
    && /(镁|mg|铝|al).{0,180}(稀盐酸|盐酸|acid|hcl).{0,180}(气泡|反应速率|剧烈|缓慢)|(?:气泡|反应速率|剧烈|缓慢).{0,180}(镁|mg|铝|al).{0,180}(稀盐酸|盐酸|acid|hcl)/i.test(text)
  ) return 'periodic_metal_activity_observation';
  if (/(ph|pH|poh|h[+⁺]|oh[-−⁻]|酸性|碱性|浓度)/i.test(text)
    && /(pH\s*试纸|容量瓶|移液管|量筒|滴定管|刻度线|定容|润湿|洗涤|仰视|俯视|残留|转移|配制|测定|volumetric|pipette|burette|meniscus|wet(?:ted|ting)?|rinse|prepar(?:e|ation)|measure(?:ment)?)/i.test(text)
    && /(偏高|偏低|升高|降低|增大|减小|不变|误差|实际值|正确|判断|higher|lower|increase|decrease|unchanged|error|correct)/i.test(text)) return 'basic_ph_measurement_or_preparation_error_judgement';
  if (/(ph|pH|酸碱|盐酸|硫酸|氢氧化钠|naoh|hcl|中和|稀释|dilution|neutralization).{0,180}(稀释|中和|体积|浓度|物质的量|poh|滴定|酸过量|碱过量)|(?:稀释|中和|体积|浓度|物质的量|poh|滴定|酸过量|碱过量).{0,180}(ph|pH|酸碱|盐酸|硫酸|氢氧化钠|naoh|hcl|dilution|neutralization)/i.test(text)) return 'ph_dilution_strong_acid_base_neutralization';
  if (/(重结晶|冷却结晶|蒸发结晶|结晶|晶体|溶解度|solubility|recrystallization|crystallization).{0,260}(分离|提纯|除杂|较纯|杂质|温度|升高|降低|冷却|蒸发|过滤|separation|purify|impurity)|(?:分离|提纯|除杂|较纯|杂质|温度|升高|降低|冷却|蒸发|过滤|separation|purify|impurity).{0,260}(重结晶|冷却结晶|蒸发结晶|结晶|晶体|溶解度|solubility|recrystallization|crystallization)/i.test(text)) return 'separation_recrystallization_solubility_selection';
  if (chemistryTopicAllowsInorganic && /(cuo|cuo|氧化铜|fe2o3|fe₂o₃|氧化铁|金属氧化物|碱性氧化物).{0,180}(稀硫酸|稀盐酸|盐酸|硫酸|酸|溶解|蓝色|黄色|fecl3|fecl₃|cuso4|cuso₄)|(?:稀硫酸|稀盐酸|盐酸|硫酸|酸|溶解|蓝色|黄色|fecl3|fecl₃|cuso4|cuso₄).{0,180}(cuo|氧化铜|fe2o3|fe₂o₃|氧化铁|金属氧化物|碱性氧化物)/i.test(text)) return 'inorganic_metal_oxide_acid_reaction_observation';
  if (chemistryTopicAllowsInorganic
    && /(so2|so₂|二氧化硫)/i.test(text)
    && /(cl2|cl₂|氯气|hclo|次氯酸)/i.test(text)
    && /(品红|漂白|褪色|加热|复原|不能复原|bleach|decolor)/i.test(text)) return 'inorganic_so2_cl2_bleaching_reversibility_contrast';
  if (chemistryTopicAllowsInorganic && /(so2|so₂|二氧化硫).{0,220}(品红|漂白|褪色|加热|恢复原色|可逆|不稳定|bleach|decolor|reversible)|(?:品红|漂白|褪色|加热|恢复原色|可逆|不稳定|bleach|decolor|reversible).{0,220}(so2|so₂|二氧化硫)/i.test(text)) return 'inorganic_sulfur_dioxide_reversible_bleaching';
  if (
    chemistryTopicAllowsInorganic
    && /(碳酸钠|na2co3|na₂co₃|碳酸盐|caco3|caco₃|石灰水|ca\\?\(oh\\?\)2|co2|co₂)/i.test(text)
    && /(盐酸|酸|气泡|白色沉淀|变浑浊|溶解|澄清|先无.*气泡|立即.*气泡)/i.test(text)
  ) return 'inorganic_carbonate_acid_limewater_observation';
  if (
    chemistryTopicAllowsInorganic
    && /(na2co3|na₂co₃|碳酸钠|碳酸盐|盐酸|稀盐酸)/i.test(text)
    && /(逐滴|过量|先无.*气泡|后产生气泡|立即产生气泡|气泡现象|nahco3|nahco₃|碳酸氢钠)/i.test(text)
  ) return 'inorganic_carbonate_acid_addition_order_gas_sequence';
  if (
    chemistryTopicAllowsInorganic
    && /(co2|co₂|二氧化碳|石灰水|ca\(oh\)2|ca\\?\(oh\\?\)2|caco3|caco₃|碳酸钙|na2co3|na₂co₃|碳酸钠)/i.test(text)
    && /(白色沉淀|变浑浊|沉淀.*溶解|气泡|使澄清石灰水|过量.*co2|过量.*co₂|cahco3|ca\(hco3\)2|ca\(hco₃\)₂)/i.test(text)
  ) return 'inorganic_carbonate_co2_limewater_multi_observation';
  if (chemistryTopicAllowsInorganic && /(铁|fe|镁|mg|钠|na|金属|铁钉|铁片|镁条).{0,180}(硫酸铜|cuso4|cuso₄|稀盐酸|水|盐溶液|置换|气泡|红色|浅绿色|浮|蓝色沉淀)|(?:置换|气泡|红色|浅绿色|浮|蓝色沉淀).{0,180}(铁|fe|镁|mg|钠|na|金属|铁钉|铁片|镁条|硫酸铜|cuso4|cuso₄|稀盐酸)/i.test(text)) return 'inorganic_metal_activity_solution_observation';
  if (chemistryTopicAllowsInorganic && /(fe3\\+|fe³\\+|cu2\\+|cu²\\+|fecl3|fecl₃|氢氧化钠|naoh|oh[-⁻]|沉淀).{0,180}(红褐色|蓝色|黄色|氢氧化铁|fe\\(oh\\)3|fe(oh)3|cu\\(oh\\)2|cu(oh)2)|(?:红褐色|蓝色|黄色|氢氧化铁|fe\\(oh\\)3|fe(oh)3|cu\\(oh\\)2|cu(oh)2).{0,180}(fe3\\+|fe³\\+|cu2\\+|cu²\\+|fecl3|fecl₃|氢氧化钠|naoh|oh[-⁻]|沉淀)/i.test(text)) return 'inorganic_ion_precipitation_color_observation';
  if (/(正戊烷|新戊烷|异丁烷|正丁烷|同分异构|支链|烷烃|isomer|alkane).{0,140}(沸点|汽化焓|色散力|接触面积|boiling|vap|dispersion|surface)|(?:沸点|汽化焓|色散力|接触面积|boiling|vap|dispersion|surface).{0,140}(正戊烷|新戊烷|异丁烷|正丁烷|同分异构|支链|烷烃|isomer|alkane)/i.test(text)) return 'bond_isomer_branching_dispersion_data';
  if (/(乙醇|二甲醚|甲醇|甲硫醇|ch3oh|ch₃oh|ch3sh|ch₃sh|methanol|methanethiol).{0,180}(汽化焓|气化热|沸点|贡献|氢键|色散力|boiling|vap|hydrogen|dispersion)|(?:汽化焓|气化热|沸点|贡献|氢键|色散力|boiling|vap|hydrogen|dispersion).{0,180}(乙醇|二甲醚|甲醇|甲硫醇|ch3oh|ch₃oh|ch3sh|ch₃sh|methanol|methanethiol)/i.test(text)) return 'bond_hydrogen_bond_data_anomaly';
  if (/(键能|键焓|断键|成键|bond energy|bond enthalpy|enthalpy).{0,180}(差值|异常|比较|计算|汽化焓|气化热|能量)|(?:差值|异常|比较|计算|汽化焓|气化热|能量).{0,180}(键能|键焓|断键|成键|bond energy|bond enthalpy|enthalpy)/i.test(text)) return 'bond_energy_enthalpy_data_anomaly';
  if (/(离子晶体|离子化合物|分子晶体|分子固体|ionic solid|molecular solid).{0,160}(熔点|沸点|导电|硬度|数据|异常|melting|boiling|conductivity)|(?:熔点|沸点|导电|硬度|数据|异常|melting|boiling|conductivity).{0,160}(离子晶体|离子化合物|分子晶体|分子固体|ionic solid|molecular solid)/i.test(text)) return 'bond_ionic_molecular_solid_data_anomaly';
  if (/(?:极性|偶极|色散力|范德华力|polarity|dipole|dispersion).{0,180}(?:沸点|熔点|汽化焓|气化热|数据|异常|比较|boiling|melting|vap)|(?:沸点|熔点|汽化焓|气化热|数据|异常|比较|boiling|melting|vap).{0,180}(?:极性|偶极|色散力|范德华力|polarity|dipole|dispersion)/i.test(text)) return 'bond_polarity_hbond_dispersion_data';
  if (/(水|h2o|h₂o|hf|h2s|h₂s|硫化氢|氢键|hydrogen bond).{0,160}(汽化焓|气化热|沸点|熔点|溶解|贡献|反常|相对分子质量|boiling|melting|solubility|vap)|(?:汽化焓|气化热|沸点|熔点|溶解|贡献|反常|相对分子质量|boiling|melting|solubility|vap).{0,160}(水|h2o|h₂o|hf|h2s|h₂s|硫化氢|氢键|hydrogen bond)/i.test(text)) return 'bond_hydrogen_bond_anomaly';
  if (/(卤素|氯水|溴水|碘水|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nai|碘化钾|溴化钾|溴化钠|碘化钠).{0,140}(半径|电负性|非金属性|同主族|趋势|radius|electronegativity|nonmetallic)|(?:半径|电负性|非金属性|同主族|趋势|radius|electronegativity|nonmetallic).{0,140}(卤素|氯水|溴水|碘水|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nai|碘化钾|溴化钾|溴化钠|碘化钠)/i.test(text)) return 'periodic_halogen_displacement_plus_trend';
  if (/(金属活动性|金属性|钠|镁|铝|na|mg|al).{0,140}(氧化物|水化物|酸性|碱性|两性|oxide|hydrate|acidic|basic|amphoteric)|(?:氧化物|水化物|酸性|碱性|两性|oxide|hydrate|acidic|basic|amphoteric).{0,140}(金属活动性|金属性|钠|镁|铝|na|mg|al)/i.test(text)) return 'periodic_metal_activity_oxide_dual_evidence';
  if (/(电离能|第一电离能|ionization energy).{0,160}(异常|例外|半满|全满|p轨道|exception|anomaly)|(?:异常|例外|半满|全满|p轨道|exception|anomaly).{0,160}(电离能|第一电离能|ionization energy)/i.test(text)) return 'periodic_ionization_energy_exception';
  if (/(未知元素|元素x|元素y|x、y、z|x,y,z|甲、乙、丙|短周期).{0,180}(电子排布|电子层|氢化物|氧化物|化合物|价态|半径|unknown element|electron configuration|hydride|oxide|compound formula)|(?:电子排布|电子层|氢化物|氧化物|化合物|价态|半径|unknown element|electron configuration|hydride|oxide|compound formula).{0,180}(未知元素|元素x|元素y|x、y、z|x,y,z|甲、乙、丙|短周期)/i.test(text)) return /化合物|compound formula|价态|valence/i.test(text)
    ? 'periodic_compound_formula_property_ranking'
    : 'periodic_unknown_element_electron_hydride_clue';
  if (/(氧化物|水化物|oxide|hydrate).{0,160}(半径|价态|电子层|核电荷|消去|排除|radius|valence|electron layer)|(?:半径|价态|电子层|核电荷|消去|排除|radius|valence|electron layer).{0,160}(氧化物|水化物|oxide|hydrate)/i.test(text)) return 'periodic_oxide_radius_valence_elimination';
  if (/(同周期|同主族|same period|same group).{0,120}(半径|电负性|金属性|非金属性|氧化物|radius|electronegativity|metallic|nonmetallic|oxide)|(?:半径|电负性|金属性|非金属性|氧化物|radius|electronegativity|metallic|nonmetallic|oxide).{0,120}(同周期|同主族|same period|same group)/i.test(text)) return 'periodic_same_period_group_dual_clue';
  if (chemistryTopicDomain === 'periodic' && /(氢化物|hcl|h2s|h₂s|hydride).{0,160}(稳定|分解|非金属性|同周期|同主族|stable|decompose|nonmetallic)|(?:稳定|分解|非金属性|同周期|同主族|stable|decompose|nonmetallic).{0,160}(氢化物|hcl|h2s|h₂s|hydride)/i.test(text)) return 'periodic_hydride_stability_trend';
  if (/(氯水|溴水|碘水|卤素|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nacl|碘化钾|溴化钾|溴化钠|氯化钠|halogen).{0,100}(置换|无明显变化|橙红|橙黄|棕黄|碘单质|溴单质|生成.*(?:br2|br₂|i2|i₂|溴|碘)|非金属性|氧化性|activity|displacement|brown|yellow)|(?:置换|无明显变化|橙红|橙黄|棕黄|碘单质|溴单质|生成.*(?:br2|br₂|i2|i₂|溴|碘)|非金属性|氧化性|activity|displacement|brown|yellow).{0,100}(氯水|溴水|碘水|卤素|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nacl|碘化钾|溴化钾|溴化钠|氯化钠|halogen)/i.test(text)) return 'periodic_halogen_displacement_observation';
  if (/(镁|mg|铝|al).{0,180}(稀盐酸|盐酸|acid|hcl).{0,180}(气泡|反应速率|剧烈|缓慢)|(?:气泡|反应速率|剧烈|缓慢).{0,180}(镁|mg|铝|al).{0,180}(稀盐酸|盐酸|acid|hcl)/i.test(text)) return 'periodic_metal_activity_observation';
  if (/(钠|镁|铝|na|mg|al|金属).{0,80}(水|酸|反应|气泡|剧烈|活动性|金属性|reactivity|metallic)|(?:反应|气泡|剧烈|活动性|金属性|reactivity|metallic).{0,80}(钠|镁|铝|na|mg|al|金属)/i.test(text)) return 'periodic_metal_activity_observation';
  if (/(氧化物|最高价氧化物|水化物|oxide).{0,80}(酸性|碱性|两性|acidic|basic|amphoteric)|(?:酸性|碱性|两性|acidic|basic|amphoteric).{0,80}(氧化物|最高价氧化物|水化物|oxide)/i.test(text)) return 'periodic_oxide_property_observation';
  if (/(等电子|相同电子|同电子|same electron|核电荷|nuclear charge|离子半径|ion radius)/i.test(text)) return 'periodic_same_electron_ion_radius';
  if (/(nh4cl|氯化铵|铵盐|某盐|离子化合物|固态|熔融|水溶液|导电|conductivity|conduct).{0,120}(不导电|能导电|导电|自由移动|离子|阳离子|阴离子|多个原子|ionic)|(?:不导电|能导电|导电|自由移动|离子|阳离子|阴离子|多个原子|ionic).{0,120}(nh4cl|氯化铵|铵盐|某盐|离子化合物|固态|熔融|水溶液|conductivity|conduct)/i.test(text)) return 'bond_ionic_solid_conductivity';
  if (chemistryTopicDomain === 'bond' && /(熔化|凝固|沸腾|汽化|相变|phase change|melting|solidification).{0,180}(分子间作用力|共价键|离子键|未破坏|克服|intermolecular|covalent|ionic)|(?:分子间作用力|共价键|离子键|未破坏|克服|intermolecular|covalent|ionic).{0,180}(熔化|凝固|沸腾|汽化|相变|phase change|melting|solidification)/i.test(text)) return 'bond_phase_change_interaction_identification';
  if (/(干冰|co2|二氧化碳|碘|低熔点|sublim|low melting).{0,80}(升华|固态直接变为气态|直接变为气体|分子晶体|molecular solid|sublim)|(?:升华|固态直接变为气态|直接变为气体|分子晶体|molecular solid|sublim).{0,80}(干冰|co2|二氧化碳|碘|低熔点|low melting)/i.test(text)) return 'bond_molecular_solid_sublimation';
  if (/(nh4|铵盐|铵根|ammonium).{0,80}(离子键|共价键|ionic|covalent)|(?:离子键|共价键|ionic|covalent).{0,80}(nh4|铵盐|铵根|ammonium)/i.test(text)) return 'bond_mixed_bond_salt_fact';
  return 'other';
}

function subjectPracticeChemistryTopicDomain(topicTitle?: string | null) {
  const title = cleanPolicyText(topicTitle).toLowerCase();
  if (!title) return null;
  if (/有机|organic/.test(title)) return 'organic';
  if (/实验室|仪器|实验安全|laboratory|lab safety|instrument/.test(title)) return 'lab';
  if (/原子结构|元素周期|周期律|atomic structure|periodic/.test(title)) return 'periodic';
  if (/化学键|分子间作用力|物质结构|bond|intermolecular/.test(title)) return 'bond';
  if (/化学平衡|平衡移动|反应速率|速率与平衡|equilibrium|reaction rate/.test(title)) return 'equilibrium';
  if (/氧化还原|redox/.test(title)) return 'redox';
  if (/化学用语|方程式|formula writing|chemical equation|notation/.test(title)) return 'notation';
  if (/物质的量|化学计量|stoichiometry|amount of substance|mole/.test(title)) return 'stoichiometry';
  if (/电解质|离子反应|盐类水解|酸碱|中和|pH|ph|electrolyte|ionic reaction|hydrolysis/.test(title)) return 'electrolyte';
  if (/气体.*(?:制备|检验|收集)|gas preparation|gas identification|gas collection/.test(title)) return 'gas_experiment';
  if (/气体定律|理想气体|gas law|ideal gas/.test(title)) return 'gas';
  if (/无机物|酸碱盐|常见物质|inorganic|acid.*base.*salt/.test(title)) return 'inorganic';
  if (/物质分类|状态变化|物理变化|化学变化|classification|state change/.test(title)) return 'classification';
  return null;
}

function subjectPracticeChemistryFamilyDomain(taskFamily?: string | null) {
  const family = cleanPolicyText(taskFamily).toLowerCase();
  if (!family || family === 'other' || family === 'unclassified') return null;
  if (family.startsWith('organic_')) return 'organic';
  if (family.startsWith('lab_')) return 'lab';
  if (/^(periodic_|halogen_|metal_activity_|oxide_property_|two_ion_same_electron)/.test(family)) return 'periodic';
  if (/^(bond_|ionic_solid_|molecular_solid_|hydrogen_bond_|mixed_bond_)/.test(family)) return 'bond';
  if (/^(equilibrium_|reaction_rate_)/.test(family)) return 'equilibrium';
  if (/^(redox_|basic_redox_)/.test(family)) return 'redox';
  if (family.startsWith('notation_')) return 'notation';
  if (/^(separation_)/.test(family)) return 'lab';
  if (/^(direct_mechanics_|mechanics_)/.test(family)) return 'physics';
  if (/^(ideal_gas_|gas_law_)/.test(family)) return 'gas';
  if (/^(gas_)/.test(family)) return 'gas_experiment';
  if (/^(ph_|electrolyte_|ionic_equation_|acid_base_|hydrolysis_)/.test(family)) return 'electrolyte';
  if (/^(precipitation_)/.test(family)) return 'electrolyte';
  if (/^(direct_stoichiometry_|stoichiometry_|mole_)/.test(family)) return 'stoichiometry';
  if (/^(amphoteric_|carbonate_|inorganic_)/.test(family)) return 'inorganic';
  if (/^(classification_)/.test(family)) return 'classification';
  if (/^(industrial_)/.test(family)) return 'industrial';
  if (/^(statistics_|probability_|normal_distribution_|mean_|variance_|arithmetic_|geometric_|sequence_|quadratic_|derivative_|conic_|spatial_|set_|inequality_|logarithmic_|function_|elementary_function_|hard_function_|hard_elementary_function_|hard_statistics_)/.test(family)) return 'math';
  if (/^(ohm_|circuit_|mechanics_|direct_mechanics_|kinematics_|dynamics_|momentum_|electric_|magnetic_|electromagnetic_|wave_|optics_|photoelectric_|coulomb_|ampere_)/.test(family)) return 'physics';
  return null;
}

function subjectPracticeMathTopicDomain(topicTitle?: string | null) {
  const title = cleanPolicyText(topicTitle).toLowerCase();
  if (!title) return null;
  if (/(向量|复数|vector|complex)/i.test(title)) return 'vector_complex';
  if (/(数列|sequence)/i.test(title)) return 'sequence';
  if (/(数据|统计|平均数|方差|标准差|概率|古典概型|statistics|mean|variance|standard deviation|probability|counting|data)/i.test(title)) return 'statistics_probability';
  if (/(函数|导数|微积分|不等式|对数|指数|function|calculus|derivative|inequality|logarithm|exponential)/i.test(title)) return 'function';
  if (/(空间|立体|几何|坐标|直线|圆|圆锥|geometry|coordinate|line|circle|conic|spatial)/i.test(title)) return 'geometry';
  return null;
}

function subjectPracticeMathFamilyDomain(taskFamily?: string | null) {
  const family = cleanPolicyText(taskFamily).toLowerCase();
  if (!family || family === 'other' || family === 'unclassified') return null;
  if (/^(vector_|complex_)/.test(family)) return 'vector_complex';
  if (/(sequence)/.test(family) || /^(arithmetic_|geometric_)/.test(family)) return 'sequence';
  if (/^(statistics_|probability_|normal_distribution_|combined_variance|mean_|direct_variance|hard_statistics_)/.test(family)) return 'statistics_probability';
  if (/^(derivative_|function_|quadratic_|rational_inequality_|inequality_|logarithmic_|elementary_function_|hard_function_|hard_elementary_function_)/.test(family)) return 'function';
  if (/^(coordinate_geometry_|spatial_|circle_|conic_)/.test(family)) return 'geometry';
  return null;
}

export function subjectPracticeTaskFamilyTopicCompatibility(input: {
  subject?: string | null;
  topicTitle?: string | null;
  taskFamily?: string | null;
}): SubjectPracticeTaskFamilyTopicCompatibility {
  const subject = cleanPolicyText(input.subject).toLowerCase();
  const topicDomain = subject === 'chemistry'
    ? subjectPracticeChemistryTopicDomain(input.topicTitle)
    : subject === 'math'
      ? subjectPracticeMathTopicDomain(input.topicTitle)
      : null;
  const familyDomain = subject === 'chemistry'
    ? subjectPracticeChemistryFamilyDomain(input.taskFamily)
    : subject === 'math'
      ? subjectPracticeMathFamilyDomain(input.taskFamily)
      : null;
  const family = cleanPolicyText(input.taskFamily).toLowerCase();
  const crossDomainAcidBaseTitration = family === 'lab_acid_base_titration_endpoint_correction'
    && (topicDomain === 'lab' || topicDomain === 'electrolyte');
  const compatible = !['chemistry', 'math'].includes(subject) || !topicDomain || !familyDomain || topicDomain === familyDomain || crossDomainAcidBaseTitration;
  return {
    compatible,
    topicDomain,
    familyDomain,
    reasonCode: compatible ? null : 'subject_practice_task_family_topic_incompatible'
  };
}

export function subjectPracticeClassifyTaskFamily(input: SubjectPracticeTaskFamilyClassifierInput) {
  const taskFamily = subjectPracticeClassifyTaskFamilyRaw(input);
  const compatibility = subjectPracticeTaskFamilyTopicCompatibility({
    subject: input.subject,
    topicTitle: input.topicTitle,
    taskFamily
  });
  return compatibility.compatible ? taskFamily : 'other';
}

function subjectPracticeFingerprintText(input: {
  prompt?: string | null;
  explanation?: string | null;
  options?: unknown;
}) {
  return cleanPolicyText(`${cleanPolicyText(input.prompt)} ${optionText(input.options)} ${cleanPolicyText(input.explanation)}`).toLowerCase();
}

const SUBJECT_PRACTICE_TEXT_STOP_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'which',
  'what',
  '求',
  '问',
  '选',
  '项',
  '正确',
  '错误',
  '下列',
  '的是',
  '一个',
  '若',
  '已知'
]);

function normalizeComparableText(text: string) {
  const subscriptNormalized = text
    .replace(/[₀０]/g, '0')
    .replace(/[₁１]/g, '1')
    .replace(/[₂２]/g, '2')
    .replace(/[₃３]/g, '3')
    .replace(/[₄４]/g, '4')
    .replace(/[₅５]/g, '5')
    .replace(/[₆６]/g, '6')
    .replace(/[₇７]/g, '7')
    .replace(/[₈８]/g, '8')
    .replace(/[₉９]/g, '9');
  return subscriptNormalized
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\frac|\\sqrt|\\mathrm|\\left|\\right/g, ' ')
    .replace(/\b[a-zA-Z]\s*[_]?\s*\d+\b/g, ' VAR ')
    .replace(/\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/g, ' NUM ')
    .replace(/\b[a-zA-Z]\b/g, ' VAR ')
    .toLowerCase();
}

function comparableTokenSet(text: string) {
  const normalized = normalizeComparableText(text);
  const tokens = new Set<string>();
  for (const raw of (normalized.match(/\p{Script=Han}+|[a-z0-9_]+/gu) ?? []).map((value) => value.trim()).filter(Boolean)) {
    if (SUBJECT_PRACTICE_TEXT_STOP_TOKENS.has(raw)) continue;
    if (/^[a-z0-9_]+$/.test(raw)) {
      if (raw.length >= 3 || raw === 'num' || raw === 'var') tokens.add(raw);
      continue;
    }
    const chars = Array.from(raw);
    if (chars.length <= 2) {
      if (!SUBJECT_PRACTICE_TEXT_STOP_TOKENS.has(raw)) tokens.add(raw);
      continue;
    }
    for (let index = 0; index < chars.length - 1; index += 1) {
      const bigram = `${chars[index]}${chars[index + 1]}`;
      if (!SUBJECT_PRACTICE_TEXT_STOP_TOKENS.has(bigram)) tokens.add(bigram);
    }
    for (let index = 0; index < chars.length - 2; index += 1) {
      tokens.add(`${chars[index]}${chars[index + 1]}${chars[index + 2]}`);
    }
  }
  return tokens;
}

export function subjectPracticeTextNearDuplicateScore(left: string, right: string) {
  const leftTokens = comparableTokenSet(cleanPolicyText(left));
  const rightTokens = comparableTokenSet(cleanPolicyText(right));
  if (leftTokens.size < 4 || rightTokens.size < 4) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = leftTokens.size + rightTokens.size - intersection;
  return union > 0 ? Number((intersection / union).toFixed(3)) : 0;
}

function comparableExpressionSet(text: string) {
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−－–—]/g, '-')
    .replace(/\s+/g, '');
  const values = new Set<string>();
  const functionExpressions = normalized.match(/[a-z]\([a-z]\)=[a-z0-9+\-*/^().]+/g) ?? [];
  for (const expression of functionExpressions) {
    if (/[+\-*/^=]/.test(expression) && expression.length >= 8) values.add(expression);
  }
  const equationExpressions = normalized.match(/[a-z0-9().^+\-*/]+=[a-z0-9().^+\-*/]+/g) ?? [];
  for (const expression of equationExpressions) {
    if (/[a-z]/.test(expression) && /[+\-*/^]/.test(expression) && expression.length >= 8) values.add(expression);
  }
  return values;
}

export function subjectPracticeExpressionNearDuplicateScore(left: string, right: string) {
  const leftExpressions = comparableExpressionSet(cleanPolicyText(left));
  const rightExpressions = comparableExpressionSet(cleanPolicyText(right));
  if (!leftExpressions.size || !rightExpressions.size) return 0;
  for (const expression of leftExpressions) {
    if (rightExpressions.has(expression)) return 0.96;
  }
  return 0;
}

function uniqueFingerprintObjects(values: string[]) {
  return Array.from(new Set(values.map((value) => cleanPolicyText(value)).filter(Boolean))).slice(0, 8);
}

function subjectPracticeRepresentationTypeFor(family: string, text: string): SubjectPracticeRepresentationType {
  if (/circuit|电路|电阻|串联|并联|基尔霍夫|欧姆/.test(family) || /(电路图|circuit diagram|circuit)/i.test(text)) return 'circuit';
  if (/graph|图像|slope|intercept/.test(family) || /(v[-\s]?t|s[-\s]?t|x[-\s]?t|a[-\s]?t|图像|graph|斜率|截距|slope|intercept)/i.test(text)) return 'graph';
  if (/ph_measurement_or_preparation_error/.test(family)) return 'experiment';
  if (/experiment/.test(family) || /(实验|探究|测量|experiment|measurement)/i.test(text)) return 'experiment';
  if (/diagram|受力分析|free.?body|如图|图中|下图|右图|左图/.test(family) || /(受力图|示意图|diagram|figure)/i.test(text)) return 'diagram';
  if (/(=|≈|>|<|≤|≥|∑|lim|sqrt|\\frac|x\^|x²|\bm\b|\bv\b|\ba\b|\bf\b|\bu\b|\bi\b|\br\b)/i.test(text)) return 'equation';
  if (/(表格|table|如下表|数据如下)/i.test(text)) return 'table';
  return 'text';
}

function subjectPracticeQuantitativeShapeFor(family: string, text: string): SubjectPracticeQuantitativeShape {
  if (/ph_measurement_or_preparation_error/.test(family)) return 'comparison';
  if (/(parameter|参数|case_analysis|分段|临界|critical|limiting|约束|constraint)/i.test(`${family} ${text}`)) return 'parameter_constraint';
  if (/(judgement|statement|命题|证明|当且仅当|counterexample|反例|proof)/i.test(`${family} ${text}`)) return 'proof_like';
  if (/(comparison|compare|ranking|比较|排序|趋势|trend|rank)/i.test(`${family} ${text}`)) return 'comparison';
  if (
    PHYSICS_DIRECT_FORMULA_TASK_FAMILIES.has(family)
    || /(direct|one.?formula|直接代入|单公式|one formula|公式直接)/i.test(`${family} ${text}`)
  ) return 'direct_formula';
  return 'multi_step';
}

function subjectPracticeAnswerFormFor(text: string, options: unknown): SubjectPracticeAnswerForm {
  const optionTextValue = optionText(options);
  if (/(排序|由大到小|由小到大|ranking|rank|order)/i.test(`${text} ${optionTextValue}`)) return 'ranking';
  if (/(下列|哪一项|正确|错误|判断|which|statement|option)/i.test(text)) return 'option_judgement';
  if (/(解释|原因|reason|explain|说明)/i.test(text) && !/(求|calculate|计算|value|值)/i.test(text)) return 'explanation';
  if (/(表达式|关系式|equation|expression|公式)/i.test(`${text} ${optionTextValue}`)) return 'expression';
  return 'numeric';
}

function subjectPracticeObjectsFor(subject: string, family: string, text: string) {
  if (subject === 'physics') {
    const values = [];
    if (/kinematics|projectile|relative_motion/.test(family)) values.push('motion');
    if (/newton|force|inclined|connected_bodies/.test(family)) values.push('force_model');
    if (/energy/.test(family)) values.push('energy');
    if (/momentum|collision|impulse/.test(family)) values.push('momentum');
    if (/circuit|ohm|kirchhoff|resistor/.test(family)) values.push('circuit');
    if (/thermodynamics|kinetic_molecular|ideal_gas|理想气体|分子动理论|等温|等压|等容/i.test(`${family} ${text}`)) values.push('thermal_model');
    if (/electrostatics|coulomb|charge_conservation|uniform_electric_field|electric field|电场|电势|电荷/i.test(`${family} ${text}`)) values.push('electric_field');
    if (/magnetism|lorentz|ampere|magnetic|磁场|安培力/i.test(`${family} ${text}`)) values.push('magnetic_field');
    if (/electromagnetic_induction|flux|lenz|faraday|电磁感应|磁通量/i.test(`${family} ${text}`)) values.push('electromagnetic_induction');
    if (/wave|optics|lens|refraction|interference|harmonic|波|光|透镜|折射|干涉|振动/i.test(`${family} ${text}`)) values.push('wave_or_optics');
    if (/atomic_|photoelectric|nuclear|原子结构|能级|光电效应|核物理|核反应|衰变|半衰期/i.test(`${family} ${text}`)) values.push('modern_physics');
    if (/experiment|measurement|实验|测量/i.test(`${family} ${text}`)) values.push('experiment');
    return uniqueFingerprintObjects(values);
  }
  if (subject === 'math') {
    const values = [];
    if (/sequence|数列/i.test(`${family} ${text}`)) values.push('sequence');
    if (/function|函数|derivative|导数|logarithm|log|对数/i.test(`${family} ${text}`)) values.push('function');
    if (/geometry|spatial|plane|circle|conic|几何|平面|圆|圆锥曲线/i.test(`${family} ${text}`)) values.push('geometry');
    if (/vector|向量|\\vec/i.test(`${family} ${text}`)) values.push('vector');
    if (/probability|概率/i.test(`${family} ${text}`)) values.push('probability');
    if (/variance|mean|statistics|方差|平均/i.test(`${family} ${text}`)) values.push('statistics');
    if (/set|集合/i.test(`${family} ${text}`)) values.push('set');
    if (/inequality|不等式/i.test(`${family} ${text}`)) values.push('inequality');
    if (/complex|复数|conjugate|共轭/i.test(`${family} ${text}`)) values.push('complex_number');
    return uniqueFingerprintObjects(values);
  }
  if (subject === 'chemistry') {
    const values = [];
    if (/periodic|元素|周期|halogen|卤素|metal|金属/i.test(`${family} ${text}`)) values.push('periodic_trend');
    if (/bond|键|intermolecular|氢键|晶体/i.test(`${family} ${text}`)) values.push('bond_or_interaction');
    if (/equilibrium|平衡|q\/?k|反应商/i.test(`${family} ${text}`)) values.push('equilibrium');
    if (/experiment|实验|探究/i.test(`${family} ${text}`)) values.push('experiment');
    if (/ph_measurement_or_preparation_error/.test(family)) {
      values.push('experiment');
      if (/(pH\s*试纸|试纸|测定|测量|蘸取|润湿|ph paper|indicator paper)/i.test(text)) values.push('ph_measurement');
      if (/(容量瓶|定容|配制|移液|转移|洗涤|刻度线|volumetric|prepar|transfer|washing|meniscus)/i.test(text)) values.push('solution_preparation');
    }
    return uniqueFingerprintObjects(values);
  }
  return [];
}

function subjectPracticeSubjectExtensionFor(subject: string, family: string, text: string): Record<string, unknown> {
  if (subject === 'physics') {
    return {
      physicalModel: /kinematics|projectile|relative_motion/.test(family)
        ? 'motion'
        : /newton|force|inclined|connected_bodies/.test(family)
          ? 'forces'
          : /atomic_|photoelectric|nuclear/.test(family)
            ? 'modern_physics'
          : /thermodynamics|kinetic_molecular|ideal_gas/.test(family)
            ? 'thermal'
          : /energy/.test(family)
            ? 'energy'
              : /momentum|collision|impulse/.test(family)
                ? 'momentum'
              : /circuit/.test(family)
                ? 'circuit'
                : /electrostatics|coulomb|uniform_electric_field|charge_conservation|magnetism|ampere|induction/.test(family)
                  ? 'field'
                  : /wave|waves|optics|harmonic/.test(family)
                    ? 'wave_or_optics'
                    : 'unknown',
      graphType: /(v[-\s]?t|速度[-\s]?时间)/i.test(text)
        ? 'velocity_time'
        : /(s[-\s]?t|x[-\s]?t|位移[-\s]?时间)/i.test(text)
          ? 'displacement_time'
          : /(a[-\s]?t|加速度[-\s]?时间)/i.test(text)
            ? 'acceleration_time'
            : null,
      circuitTopology: /串联|series/i.test(text)
        ? 'series'
        : /并联|parallel/i.test(text)
          ? 'parallel'
          : /基尔霍夫|kirchhoff|支路|branch/i.test(text)
            ? 'multi_branch'
            : null,
      conservedQuantity: /动量|momentum/i.test(text)
        ? 'momentum'
        : /机械能|energy conservation|能量守恒/i.test(text)
          ? 'mechanical_energy'
          : null
    };
  }
  if (subject === 'math') {
    return {
      sequenceType: /arithmetic|等差/.test(family) ? 'arithmetic' : /geometric|等比/.test(family) ? 'geometric' : null,
      functionType: /quadratic|二次/.test(family) ? 'quadratic' : /derivative|导数/.test(family) ? 'derivative' : null,
      statisticType: /variance|方差/.test(family) ? 'variance' : /mean|平均/.test(family) ? 'mean' : null
    };
  }
  if (subject === 'chemistry') {
    const phOperationErrorFamily = /ph_measurement_or_preparation_error/.test(family);
    return {
      chemistryModel: phOperationErrorFamily
        ? 'ph_measurement_or_preparation_error'
        : /equilibrium|平衡/.test(family)
          ? 'equilibrium'
          : /periodic|周期/.test(family)
            ? 'periodic_trend'
            : /bond|键/.test(family)
              ? 'bonding'
              : null,
      conditionChange: phOperationErrorFamily
        ? /(润湿|蘸水|湿润|wet|moisten)/i.test(text)
          ? 'paper_wetting'
          : /(俯视|仰视|刻度线|定容|容量瓶|meniscus|final volume|volumetric)/i.test(text)
            ? 'meniscus_or_final_volume'
            : /(转移|洗涤|移液|transfer|washing)/i.test(text)
              ? 'transfer_or_washing'
              : 'operation_error'
        : /pressure|压缩|体积/.test(text)
          ? 'pressure_or_volume'
          : /temperature|升温|降温|温度/.test(text)
            ? 'temperature'
            : null
    };
  }
  return {};
}

export function subjectPracticeBuildQuestionFingerprint(input: {
  subject?: string | null;
  topicId?: number | string | null;
  topicTitle?: string | null;
  difficulty?: string | null;
  taskFamily?: string | null;
  prompt?: string | null;
  options?: unknown;
  explanation?: string | null;
}): SubjectPracticeQuestionFingerprint {
  const subject = cleanPolicyText(input.subject).toLowerCase();
  const text = subjectPracticeFingerprintText(input);
  const promptText = cleanPolicyText(input.prompt).toLowerCase();
  const structuralText = cleanPolicyText(`${promptText} ${optionText(input.options)}`).toLowerCase();
  const classifiedTaskFamily = cleanPolicyText(input.taskFamily) || subjectPracticeClassifyTaskFamily(input) || 'other';
  const topicCompatibility = subjectPracticeTaskFamilyTopicCompatibility({
    subject,
    topicTitle: input.topicTitle,
    taskFamily: classifiedTaskFamily
  });
  const taskFamily = topicCompatibility.compatible ? classifiedTaskFamily : 'other';
  const representationType = subjectPracticeRepresentationTypeFor(taskFamily, structuralText);
  const quantitativeShape = subjectPracticeQuantitativeShapeFor(taskFamily, text);
  const answerForm = /ph_measurement_or_preparation_error/.test(taskFamily)
    ? 'option_judgement'
    : subjectPracticeAnswerFormFor(promptText, input.options);
  return {
    subject,
    topicId: Number.isFinite(Number(input.topicId)) ? Number(input.topicId) : null,
    topicTitle: cleanPolicyText(input.topicTitle) || null,
    difficulty: cleanPolicyText(input.difficulty).toLowerCase(),
    taskFamily,
    topicCompatibility,
    reasoningPath: uniqueFingerprintObjects([
      quantitativeShape,
      representationType,
      answerForm
    ]),
    representationType,
    quantitativeShape,
    answerForm,
    objects: subjectPracticeObjectsFor(subject, taskFamily, text),
    subjectExtension: subjectPracticeSubjectExtensionFor(subject, taskFamily, text),
    policyVersion: SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION,
    taskFamilyPolicyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    fingerprintPolicyVersion: SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION
  };
}

function nearDuplicateComparableFor(question: SubjectPracticeNearDuplicateQuestion) {
  const fingerprint = question.fingerprint && typeof question.fingerprint === 'object' ? question.fingerprint : null;
  const taskFamily = cleanPolicyText(fingerprint?.taskFamily)
    || cleanPolicyText(question.taskFamily)
    || subjectPracticeClassifyTaskFamily({
      subject: question.subject,
      topicTitle: question.topicTitle,
      prompt: question.prompt,
      options: question.options,
      explanation: question.explanation
    })
    || 'other';
  const topicId = Number.isFinite(Number(question.topicId ?? fingerprint?.topicId)) ? Number(question.topicId ?? fingerprint?.topicId) : null;
  return {
    id: question.id ?? null,
    subject: cleanPolicyText(question.subject ?? fingerprint?.subject).toLowerCase(),
    topicId,
    topicTitle: cleanPolicyText(question.topicTitle).toLowerCase(),
    difficulty: cleanPolicyText(question.difficulty ?? fingerprint?.difficulty).toLowerCase(),
    taskFamily,
    text: subjectPracticeFingerprintText(question)
  };
}

export function subjectPracticeNearDuplicateSignal(input: {
  candidate: SubjectPracticeNearDuplicateQuestion;
  recent: SubjectPracticeNearDuplicateQuestion[];
  minTokenJaccard?: number | null;
}): SubjectPracticeNearDuplicateSignal {
  const candidate = nearDuplicateComparableFor(input.candidate);
  const minTokenJaccard = Math.max(0.5, Math.min(0.95, Number(input.minTokenJaccard) || 0.72));
  let comparedCount = 0;
  let best: {
    id: number | string | null;
    family: string | null;
    similarity: number;
    similaritySource: 'token_jaccard' | 'expression_signature';
    textSimilarity: number;
    expressionSimilarity: number;
    sharedFamily: boolean;
  } | null = null;

  if (!candidate.taskFamily || candidate.taskFamily === 'other') {
    return {
      policyVersion: SUBJECT_PRACTICE_NEAR_DUPLICATE_POLICY_VERSION,
      nearDuplicatePolicyVersion: SUBJECT_PRACTICE_NEAR_DUPLICATE_POLICY_VERSION,
      decision: 'pass',
      reasonCode: null,
      nearestId: null,
      similarity: 0,
      similaritySource: null,
      textSimilarity: 0,
      expressionSimilarity: 0,
      sharedFamily: false,
      candidateFamily: candidate.taskFamily,
      nearestFamily: null,
      comparedCount
    };
  }

  for (const item of input.recent) {
    const recent = nearDuplicateComparableFor(item);
    if (candidate.id !== null && recent.id !== null && String(candidate.id) === String(recent.id)) continue;
    if (candidate.subject && recent.subject && candidate.subject !== recent.subject) continue;
    if (!recent.taskFamily || recent.taskFamily === 'other') continue;
    const sharedFamily = candidate.taskFamily === recent.taskFamily;
    const sameTopic = candidate.topicId !== null && recent.topicId !== null
      ? candidate.topicId === recent.topicId
      : Boolean(candidate.topicTitle && recent.topicTitle && candidate.topicTitle === recent.topicTitle);
    const sameDifficulty = Boolean(candidate.difficulty && recent.difficulty && candidate.difficulty === recent.difficulty);
    if (!sharedFamily && !(sameTopic && sameDifficulty)) continue;
    comparedCount += 1;
    const textSimilarity = subjectPracticeTextNearDuplicateScore(candidate.text, recent.text);
    const expressionSimilarity = subjectPracticeExpressionNearDuplicateScore(candidate.text, recent.text);
    const similaritySource = expressionSimilarity > textSimilarity ? 'expression_signature' : 'token_jaccard';
    const similarity = Math.max(textSimilarity, expressionSimilarity);
    const threshold = sharedFamily ? minTokenJaccard : Math.min(0.95, minTokenJaccard + 0.08);
    if (similarity < threshold) continue;
    if (!best || similarity > best.similarity) {
      best = {
        id: recent.id,
        family: recent.taskFamily,
        similarity,
        similaritySource,
        textSimilarity,
        expressionSimilarity,
        sharedFamily
      };
    }
  }

  return {
    policyVersion: SUBJECT_PRACTICE_NEAR_DUPLICATE_POLICY_VERSION,
    nearDuplicatePolicyVersion: SUBJECT_PRACTICE_NEAR_DUPLICATE_POLICY_VERSION,
    decision: best ? 'warn' : 'pass',
    reasonCode: best ? 'fingerprint_near_duplicate' : null,
    nearestId: best?.id ?? null,
    similarity: best?.similarity ?? 0,
    similaritySource: best?.similaritySource ?? null,
    textSimilarity: best?.textSimilarity ?? 0,
    expressionSimilarity: best?.expressionSimilarity ?? 0,
    sharedFamily: best?.sharedFamily ?? false,
    candidateFamily: candidate.taskFamily,
    nearestFamily: best?.family ?? null,
    comparedCount
  };
}

export function subjectPracticeEvaluateDiversityWindow(input: {
  candidateFamily: string;
  acceptedFamilies: string[];
  candidateReasoningPath?: string[] | null;
  acceptedReasoningPaths?: Array<string[] | null | undefined> | null;
  targetCount?: number | null;
  recentWindowSize?: number | null;
}): SubjectPracticeDiversityWindowResult {
  const candidateFamily = cleanPolicyText(input.candidateFamily);
  const acceptedFamilies = input.acceptedFamilies
    .map((family) => cleanPolicyText(family))
    .filter(Boolean);
  const acceptedCount = acceptedFamilies.length;
  const acceptedFamilyCount = acceptedFamilies.filter((family) => family === candidateFamily).length;
  const recentWindowSize = Math.max(1, Math.min(20, Number(input.recentWindowSize) || 5));
  const recentWindowFamilies = acceptedFamilies.slice(0, recentWindowSize);
  const recentFamilyCount = recentWindowFamilies.filter((family) => family === candidateFamily).length;
  const nextCount = acceptedCount + 1;
  const nextFamilyShare = nextCount > 0 ? (acceptedFamilyCount + 1) / nextCount : 0;
  const targetCount = Math.max(1, Number(input.targetCount) || 1);
  const reasons: string[] = [];
  const candidateReasoningPath = uniqueFingerprintObjects(input.candidateReasoningPath ?? []);
  const acceptedReasoningPaths = Array.isArray(input.acceptedReasoningPaths) ? input.acceptedReasoningPaths : [];
  const latestReasoningPath = uniqueFingerprintObjects(acceptedReasoningPaths[0] ?? []);
  const repeatedReasoningPath = candidateReasoningPath.length > 0
    && latestReasoningPath.length > 0
    && candidateReasoningPath.join('|') === latestReasoningPath.join('|')
    ? candidateReasoningPath
    : [];
  let decision: SubjectPracticeDiversityWindowDecision = 'pass';
  const familyWindowScope = subjectPracticeDiversityFamilyWindowScope(candidateFamily);
  const activeWindow = familyWindowScope === 'legacy_gated';

  if (!activeWindow) {
    return {
      policyVersion: SUBJECT_PRACTICE_DIVERSITY_WINDOW_POLICY_VERSION,
      taskFamilyPolicyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
      diversityWindowPolicyVersion: SUBJECT_PRACTICE_DIVERSITY_WINDOW_POLICY_VERSION,
      familyWindowScope,
      activeWindow,
      decision,
      candidateFamily,
      acceptedCount,
      acceptedFamilyCount,
      recentWindowSize,
      recentFamilyCount,
      nextFamilyShare: Number(nextFamilyShare.toFixed(3)),
      reasons,
      repeatedReasoningPath,
      repeatedPatterns: []
    };
  }

  if (repeatedReasoningPath.length > 0 && recentFamilyCount >= 1) {
    decision = 'regenerate';
    reasons.push('reasoning_path_repeated');
  }
  if (recentFamilyCount >= 1) {
    if (decision === 'pass') decision = 'warn';
    reasons.push('recent_task_family_seen');
  }
  if (recentFamilyCount + 1 > 2) {
    decision = 'regenerate';
    reasons.push('task_family_recent_window_cap');
  }
  const repeatedEarly = nextCount >= 3 && acceptedFamilyCount >= 2 && nextFamilyShare >= 0.6;
  const repeatedMature = acceptedFamilyCount >= Math.max(3, Math.ceil(targetCount * 0.3));
  if (repeatedEarly || repeatedMature) {
    decision = 'regenerate';
    reasons.push('task_family_overrepresented');
  }

  return {
    policyVersion: SUBJECT_PRACTICE_DIVERSITY_WINDOW_POLICY_VERSION,
    taskFamilyPolicyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    diversityWindowPolicyVersion: SUBJECT_PRACTICE_DIVERSITY_WINDOW_POLICY_VERSION,
    familyWindowScope,
    activeWindow,
    decision,
    candidateFamily,
    acceptedCount,
    acceptedFamilyCount,
    recentWindowSize,
    recentFamilyCount,
    nextFamilyShare: Number(nextFamilyShare.toFixed(3)),
    reasons: Array.from(new Set(reasons)),
    repeatedReasoningPath,
    repeatedPatterns: decision === 'pass' ? [] : [candidateFamily]
  };
}

export function subjectPracticeBuildSchedulerHint(input: {
  subject?: string | null;
  topicTitle?: string | null;
  difficulty?: string | null;
  targetProfile?: unknown;
  recentAcceptedFamilies?: string[] | null;
  recentCandidateFamilies?: string[] | null;
  recentDeliveryFailedFamilies?: string[] | null;
}): SubjectPracticeSchedulerHint | null {
  const subject = cleanPolicyText(input.subject).toLowerCase();
  if (subject !== 'math') return null;
  const target = subjectPracticeMathSchedulerTargetFor({
    topicTitle: input.topicTitle,
    difficulty: input.difficulty
  });
  if (!target) return null;
  const topicText = cleanPolicyText(input.topicTitle).toLowerCase();
  const rawPool = mathSchedulerFamilyPoolFor(target, topicText);
  const compatiblePool = rawPool.filter((family) => subjectPracticeTaskFamilyTopicCompatibility({
    subject,
    topicTitle: input.topicTitle,
    taskFamily: family
  }).compatible);
  const pool = compatiblePool.length ? compatiblePool : rawPool;
  if (!pool.length) return null;
  const acceptedFamilies = optionalCleanFamilies(input.recentAcceptedFamilies);
  const candidateFamilies = optionalCleanFamilies(input.recentCandidateFamilies);
  const deliveryFailedFamilies = optionalCleanFamilies(input.recentDeliveryFailedFamilies)
    .filter((family) => pool.includes(family));
  const deliveryFailedSet = new Set(deliveryFailedFamilies);
  const targetProfileQuestionForm = schedulerTargetProfileQuestionForm(input.targetProfile);
  const targetProfileCalculationLoad = schedulerTargetProfileCalculationLoad(input.targetProfile);
  const targetProfileConstraintPressure = /^(concept_judgement|concept_check|concept_identification)$/i.test(targetProfileQuestionForm)
    && targetProfileCalculationLoad === 'heavy'
    ? 'concept_judgement_heavy_calculation' as const
    : null;
  const acceptedCounts = familyCounts(acceptedFamilies);
  const candidateCounts = familyCounts(candidateFamilies);
  const viablePool = pool.some((family) => !deliveryFailedSet.has(family))
    ? pool.filter((family) => !deliveryFailedSet.has(family))
    : pool;
  const diversityBlockedFamilies = pool.filter((family) => Boolean(subjectPracticeTaskFamilyDiversityBlock({
    candidateFamily: family,
    acceptedFamilies
  })));
  const diversityViablePool = pool.some((family) => !diversityBlockedFamilies.includes(family))
    ? pool.filter((family) => !diversityBlockedFamilies.includes(family))
    : pool;
  const preferredFamily = [...pool].sort((left, right) => {
    const leftDiversityPenalty = diversityViablePool.includes(left) ? 0 : 1000;
    const rightDiversityPenalty = diversityViablePool.includes(right) ? 0 : 1000;
    const leftDeliveryPenalty = viablePool.includes(left) ? 0 : 100;
    const rightDeliveryPenalty = viablePool.includes(right) ? 0 : 100;
    const leftAcceptedCount = acceptedCounts.get(left) ?? 0;
    const rightAcceptedCount = acceptedCounts.get(right) ?? 0;
    const leftCandidateCount = candidateCounts.get(left) ?? 0;
    const rightCandidateCount = candidateCounts.get(right) ?? 0;
    return leftDiversityPenalty - rightDiversityPenalty
      || leftDeliveryPenalty - rightDeliveryPenalty
      || (leftAcceptedCount + leftCandidateCount * 2) - (rightAcceptedCount + rightCandidateCount * 2)
      || leftCandidateCount - rightCandidateCount
      || leftAcceptedCount - rightAcceptedCount
      || pool.indexOf(left) - pool.indexOf(right);
  })[0];
  if (!preferredFamily) return null;
  const preferredGuidance = mathSchedulerFamilyPromptGuidance(preferredFamily);
  const avoidFamilies = [...new Set([...candidateFamilies, ...acceptedFamilies].filter((family) => pool.includes(family) && family !== preferredFamily))]
    .sort((left, right) => {
      const leftCandidateCount = candidateCounts.get(left) ?? 0;
      const rightCandidateCount = candidateCounts.get(right) ?? 0;
      const leftAcceptedCount = acceptedCounts.get(left) ?? 0;
      const rightAcceptedCount = acceptedCounts.get(right) ?? 0;
      return rightCandidateCount - leftCandidateCount
        || rightAcceptedCount - leftAcceptedCount
        || pool.indexOf(left) - pool.indexOf(right);
    })
    .slice(0, 4);
  return {
    policyVersion: SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION,
    schedulerPolicyVersion: SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION,
    subject,
    preferredFamily,
    preferredFamilyLabel: preferredGuidance.label,
    preferredFamilyInstruction: preferredGuidance.instruction,
    ...(targetProfileQuestionForm
      ? {
        targetProfileQuestionForm,
        ...(targetProfileCalculationLoad ? { targetProfileCalculationLoad } : {}),
        targetProfileCompatibility: 'target_profile_primary_scheduler_shape_secondary' as const
      }
      : {}),
    ...(targetProfileConstraintPressure ? { targetProfileConstraintPressure } : {}),
    ...(deliveryFailedFamilies.length
      ? {
        deliveryCooldownFamilies: Array.from(new Set(deliveryFailedFamilies)).slice(0, 4),
        deliveryFailurePolicy: 'deprioritize_for_delivery_only_not_quality_memory' as const
      }
      : {}),
    ...(diversityBlockedFamilies.length
      ? {
        diversityBlockedFamilies: Array.from(new Set(diversityBlockedFamilies)).slice(0, 4),
        diversityWindowPolicy: 'avoid_legacy_gate_blocked_family' as const
      }
      : {}),
    avoidFamilies,
    avoidFamilyLabels: avoidFamilies.map((family) => mathSchedulerFamilyPromptGuidance(family).label),
    reason: diversityBlockedFamilies.length
      ? 'low_coverage_math_family_with_diversity_window'
      : deliveryFailedFamilies.length
        ? 'low_coverage_math_family_with_delivery_cooldown'
        : candidateFamilies.length
          ? 'low_coverage_math_family_with_candidate_pressure'
          : 'low_coverage_math_family'
  };
}

export function subjectPracticeTaskFamilyDiversityBlock(input: {
  candidateFamily: string;
  acceptedFamilies: string[];
  targetCount?: number | null;
}): SubjectPracticeTaskFamilyDiversityBlock | null {
  const decision = subjectPracticeEvaluateDiversityWindow({
    candidateFamily: input.candidateFamily,
    acceptedFamilies: input.acceptedFamilies,
    targetCount: input.targetCount
  });
  if (!decision.reasons.includes('task_family_overrepresented')) return null;
  return {
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    reasonCode: 'subject_practice_task_family_overrepresented',
    candidateFamily: decision.candidateFamily,
    acceptedCount: decision.acceptedCount,
    acceptedFamilyCount: decision.acceptedFamilyCount,
    nextFamilyShare: decision.nextFamilyShare,
    repeatedPatterns: decision.repeatedPatterns
  };
}

export function subjectPracticeMathDifficultyAudit(input: {
  difficulty?: string | null;
  taskFamily?: string | null;
}): SubjectPracticeMathDifficultyAudit | null {
  const difficulty = cleanPolicyText(input.difficulty).toLowerCase();
  const taskFamily = cleanPolicyText(input.taskFamily);
  if (!difficulty || !taskFamily || taskFamily === 'other') return null;
  if ((difficulty === 'hard' || difficulty === '困难') && MATH_HARD_SIMPLE_TASK_FAMILIES.has(taskFamily)) {
    return {
      policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
      severity: 'P1',
      reasonCode: 'math_hard_simple_task_family',
      taskFamily,
      message: 'Hard math production candidate uses a task family that is usually a direct concept or short formula application; offline difficulty audit is required.'
    };
  }
  if ((difficulty === 'medium' || difficulty === '中等') && MATH_MEDIUM_BASIC_TASK_FAMILIES.has(taskFamily)) {
    return {
      policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
      severity: 'P2',
      reasonCode: 'math_medium_basic_task_family',
      taskFamily,
      message: 'Medium math production candidate looks like a basic one-step statistics shell; track it as a difficulty-stability warning.'
    };
  }
  return null;
}

export function subjectPracticePhysicsDifficultyAudit(input: {
  difficulty?: string | null;
  taskFamily?: string | null;
}): SubjectPracticePhysicsDifficultyAudit | null {
  const difficulty = cleanPolicyText(input.difficulty).toLowerCase();
  const taskFamily = cleanPolicyText(input.taskFamily);
  if (!difficulty || !taskFamily || taskFamily === 'other') return null;
  if ((difficulty === 'hard' || difficulty === '困难') && PHYSICS_DIRECT_FORMULA_TASK_FAMILIES.has(taskFamily)) {
    return {
      policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
      severity: 'P2',
      reasonCode: 'physics_hard_direct_formula_task_family',
      taskFamily,
      message: 'Hard physics candidate uses a direct formula or one graph read shell; keep it audit-only until sampled production evidence justifies blocking.'
    };
  }
  return null;
}

function subjectPracticeHasHorizontalElectricField(prompt: string) {
  return /(电场|electric\s+field)[^。；;,.，]*(水平|向右|向左|horizontal|right|left)/i.test(prompt)
    || /(水平|向右|向左|horizontal|right|left)[^。；;,.，]*(电场|electric\s+field)/i.test(prompt);
}

function subjectPracticeHasHorizontalInitialVelocity(prompt: string) {
  return /(初速度|初始速度|速度|initial\s+(?:velocity|speed)|velocity)[^。；;,.，]*(水平|horizontal)/i.test(prompt)
    || /(水平|horizontal)[^。；;,.，]*(射入|进入|抛出|运动|速度|velocity)/i.test(prompt);
}

function subjectPracticeAsksVerticalOffset(prompt: string) {
  return /(竖直|垂直|vertical)[^。；;,.，]*(偏移|位移|距离|offset|displacement|deflection)/i.test(prompt)
    || /(偏移|位移|offset|displacement|deflection)[^。；;,.，]*(竖直|垂直|vertical)/i.test(prompt);
}

function subjectPracticeHasVerticalForceSource(prompt: string) {
  const withoutNegatedGravity = prompt.replace(/不计重力|忽略重力|neglect(?:ing)?\s+gravity|ignore(?:s|ing)?\s+gravity/gi, '');
  return /重力|gravity|竖直[^。；;,.，]*(电场|electric\s+field)|vertical[^。；;,.，]*(electric\s+field)/i.test(withoutNegatedGravity);
}

function subjectPracticePhysicsFieldDeflectionAxisConflict(input: { prompt?: string | null }) {
  const prompt = cleanPolicyText(input.prompt);
  return subjectPracticeHasHorizontalInitialVelocity(prompt)
    && subjectPracticeHasHorizontalElectricField(prompt)
    && subjectPracticeAsksVerticalOffset(prompt)
    && !subjectPracticeHasVerticalForceSource(prompt);
}

type SubjectPracticeAxisDirection = 'up' | 'down' | 'left' | 'right';

function subjectPracticeDirectionFromText(value: string, keywordPattern: string): SubjectPracticeAxisDirection | null {
  const text = cleanPolicyText(value).toLowerCase();
  const patterns: Array<[SubjectPracticeAxisDirection, RegExp]> = [
    ['up', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向上|竖直向上|upward|up)`, 'i')],
    ['down', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向下|竖直向下|downward|down)`, 'i')],
    ['left', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向左|水平向左|leftward|left)`, 'i')],
    ['right', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向右|水平向右|rightward|right)`, 'i')],
    ['up', new RegExp(`(向上|竖直向上|upward|up)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['down', new RegExp(`(向下|竖直向下|downward|down)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['left', new RegExp(`(向左|水平向左|leftward|left)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['right', new RegExp(`(向右|水平向右|rightward|right)[^。；;.]{0,80}${keywordPattern}`, 'i')]
  ];
  for (const [direction, pattern] of patterns) {
    if (pattern.test(text)) return direction;
  }
  return null;
}

function subjectPracticeMovementDirectionFromPrompt(prompt: string): SubjectPracticeAxisDirection | null {
  if (/沿(?:着)?电场方向|顺(?:着)?电场方向|along\s+the\s+electric\s+field/i.test(prompt)) {
    return subjectPracticeDirectionFromText(prompt, '(?:电场|electric\\s+field)');
  }
  return subjectPracticeDirectionFromText(prompt, '(?:移动|运动|位移|移到|到达|moves?|travels?|displacement)');
}

function subjectPracticePhysicsPotentialEnergySignConflict(input: { prompt?: string | null; explanation?: string | null }) {
  const prompt = cleanPolicyText(input.prompt);
  const explanation = cleanPolicyText(input.explanation);
  const body = `${prompt} ${explanation}`;
  const positiveCharge = /正电荷|带正电|电荷量为\s*\+?\s*q|电荷量\s*[=＝]\s*\+|positive\s+charge|\bq\s*>\s*0|\+\s*q\b/i.test(body);
  if (!positiveCharge || /负电荷|带负电|negative\s+charge|\bq\s*<\s*0/i.test(body)) return false;
  const fieldDirection = subjectPracticeDirectionFromText(prompt, '(?:电场|electric\\s+field)');
  const movementDirection = subjectPracticeMovementDirectionFromPrompt(prompt);
  const fieldDrivenPerpendicularEntry = /垂直[^。；;,.，]*(?:进入|射入)[^。；;,.，]*(?:电场)|(?:enter|enters|entered)[^。；;,.，]*(?:perpendicular|normal)[^。；;,.，]*(?:electric\s+field)/i.test(prompt)
    && Boolean(fieldDirection);
  const alongField = /沿(?:着)?电场方向|顺(?:着)?电场方向|along\s+the\s+electric\s+field/i.test(prompt)
    || Boolean(fieldDirection && movementDirection && fieldDirection === movementDirection)
    || fieldDrivenPerpendicularEntry;
  if (!alongField) return false;
  const claimsIncrease = /电势能(?:的)?(?:增加量|增大|增加)|potential\s+energy\s+(?:increases?|increase)|Δ\s*(?:u|e[pP])\s*>\s*0/i.test(body);
  const usesPositiveFieldWorkAsEnergy = /(?:Δ|delta)\s*(?:u|e[pP])\s*=\s*q\s*e|电势能[^。；;,.，]*(?:qE|q\s*E)|(?:qE|q\s*E)[^。；;,.，]*电势能/i.test(explanation);
  return claimsIncrease || usesPositiveFieldWorkAsEnergy;
}

function subjectPracticePhysicsUnbackedVisualReference(input: { prompt?: string | null }) {
  const prompt = cleanPolicyText(input.prompt);
  return /如图(?:所示)?|图所示|图中|下图|上图|右图|左图|shown in (?:the )?(?:figure|diagram)|as shown|shown below|(?:figure|diagram) below/i.test(prompt);
}

function subjectPracticePhysicsVisualCurrentPolicyEnabled() {
  return String(process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function subjectPracticeCurrentPolicyBlockReasons(input: {
  subject?: string | null;
  designedDifficulty?: string | null;
  prompt?: string | null;
  options?: unknown;
  explanation?: string | null;
}) {
  const subject = cleanPolicyText(input.subject).toLowerCase();
  if (subject === 'physics') {
    const reasons: string[] = [];
    if (subjectPracticePhysicsFieldDeflectionAxisConflict(input)) reasons.push('physics_field_deflection_axis_conflict');
    if (subjectPracticePhysicsPotentialEnergySignConflict(input)) reasons.push('physics_potential_energy_sign_conflict');
    if (subjectPracticePhysicsVisualCurrentPolicyEnabled() && subjectPracticePhysicsUnbackedVisualReference(input)) reasons.push('unbacked_visual_reference');
    return reasons;
  }
  if (subject !== 'math') return [];
  const taskFamily = subjectPracticeClassifyTaskFamily({
    subject,
    prompt: input.prompt,
    options: input.options,
    explanation: input.explanation
  });
  const difficultyAudit = subjectPracticeMathDifficultyAudit({
    difficulty: input.designedDifficulty,
    taskFamily
  });
  return difficultyAudit ? [difficultyAudit.reasonCode] : [];
}

function hardEquilibriumUsedVariants(hints: string[]) {
  const used = new Set<string>();
  for (const hint of hints) {
    if (/equilibrium_concentration_qk_perturbation|equilibrium_pressure_volume_shift/i.test(hint)) {
      used.add('competing_volume_and_composition_effect');
    }
    if (/reaction_rate_relation|equilibrium_catalyst/i.test(hint)) {
      used.add('rate_versus_equilibrium_distinction');
    }
    if (/conversion|yield|amount_trend|equilibrium_observation_shift/i.test(hint)) {
      used.add('conversion_yield_direction_from_two_conditions');
    }
  }
  return used;
}

function basicChemistryObservationUsedVariants(hints: string[]) {
  const used = new Set<string>();
  for (const hint of hints) {
    if (/metal_activity|metal_copper_salt|metal\/copper|metal-activity|metal activity|金属活动|金属性/i.test(hint)) {
      used.add('metal_activity_single_observation');
    }
    if (/halogen|halogen_displacement|卤素|氯水|溴水|碘水|ki|kbr|nabr|碘化钾|溴化钾|溴化钠/i.test(hint)) {
      used.add('halogen_displacement_single_observation');
    }
    if (/oxide|acidity|basicity/i.test(hint)) {
      used.add('oxide_property_single_observation');
    }
    if (/ion_radius|same_electron|periodic_trend|direct_periodic_trend_statement/i.test(hint)) {
      used.add('two_ion_same_electron_direct_radius');
    }
    if (/ionic|conduct|conductivity|electrolyte/i.test(hint)) {
      used.add('ionic_solid_state_conductivity');
    }
    if (/sublim|dry_ice|molecular|intermolecular/i.test(hint)) {
      used.add('molecular_solid_sublimation');
    }
    if (/hydrogen.?bond|boiling|hydride/i.test(hint)) {
      used.add('hydrogen_bond_single_anomaly');
    }
    if (/nh4|ammonium|mixed_bond|ionic_plus_covalent/i.test(hint)) {
      used.add('mixed_bond_salt_single_fact');
    }
  }
  return used;
}

function chemistryProductionTaskFamilyUsedVariants(hints: string[]) {
  const used = new Set<string>();
  for (const hint of hints) {
    if (/periodic_same_period_group_dual_clue|same-period|same period|same-group|same group|同周期|同主族/i.test(hint)) {
      used.add('periodic_same_period_group_dual_clue');
    }
    if (/periodic_halogen_displacement_plus_trend|periodic_halogen_displacement_observation|halogen|halogen_displacement|卤素|氯水|溴水|碘水|ki|kbr|nabr|碘化钾|溴化钾|溴化钠/i.test(hint)) {
      used.add('periodic_halogen_displacement_plus_trend');
    }
    if (/periodic_metal_activity_oxide_dual_evidence|periodic_metal_activity_observation|metal_activity|metal_copper_salt|金属活动|金属性|oxide|氧化物|水化物/i.test(hint)) {
      used.add('periodic_metal_activity_oxide_dual_evidence');
    }
    if (/periodic_same_electron_radius_plus_position|periodic_same_electron_ion_radius|same_electron|ion_radius|等电子|同电子|离子半径/i.test(hint)) {
      used.add('periodic_same_electron_radius_plus_position');
    }
    if (/periodic_unknown_element_electron_hydride_clue|unknown element|未知元素|电子排布|氢化物|hydride/i.test(hint)) {
      used.add('periodic_unknown_element_electron_hydride_clue');
    }
    if (/periodic_ionization_energy_exception|ionization energy|电离能|例外|异常/i.test(hint)) {
      used.add('periodic_ionization_energy_exception');
    }
    if (/periodic_oxide_radius_valence_elimination|oxide.*radius|hydrate.*radius|氧化物.*半径|水化物.*半径|价态/i.test(hint)) {
      used.add('periodic_oxide_radius_valence_elimination');
    }
    if (/periodic_compound_formula_property_ranking|compound formula|化合物|价态/i.test(hint)) {
      used.add('periodic_compound_formula_property_ranking');
    }
    if (/bond_isomer_branching_dispersion_data|isomer|branching|支链|同分异构|烷烃/i.test(hint)) {
      used.add('bond_isomer_branching_dispersion_data');
    }
    if (/bond_ionic_molecular_solid_data_anomaly|ionic.*molecular|离子晶体|分子晶体|熔点|导电/i.test(hint)) {
      used.add('bond_ionic_molecular_solid_data_anomaly');
    }
    if (/bond_energy_enthalpy_data_anomaly|bond energy|bond enthalpy|键能|键焓|汽化焓|气化热/i.test(hint)) {
      used.add('bond_energy_enthalpy_data_anomaly');
    }
    if (/bond_polarity_hbond_dispersion_data|bond_hydrogen_bond_data_anomaly|polarity|hydrogen|dispersion|极性|氢键|色散力/i.test(hint)) {
      used.add('bond_polarity_hbond_dispersion_data');
    }
  }
  return used;
}

function mathProductionTaskFamilyUsedVariants(hints: string[]) {
  const used = new Set<string>();
  for (const hint of hints) {
    if (/arithmetic_sequence_two_condition_solve_a1_d|sequence_sum_condition|等差数列|公差/i.test(hint)) {
      used.add('sequence_sum_condition_then_term_property');
      used.add('sequence_arithmetic_geometric_comparison');
    }
    if (/geometric_sequence_two_condition_solve_q|等比数列|公比/i.test(hint)) {
      used.add('sequence_arithmetic_geometric_comparison');
    }
    if (/recurrence|递推|closed.?form|case_analysis|参数/i.test(hint) && /sequence|数列/i.test(hint)) {
      used.add('sequence_recurrence_to_closed_form_plus_inequality');
      used.add('sequence_parameter_case_analysis');
    }
    if (/mean_removed_value|平均数|去掉|removed/i.test(hint)) {
      used.add('statistics_missing_value_then_variance_or_range');
    }
    if (/combined_variance|variance|方差|weighted|frequency|频数/i.test(hint)) {
      used.add('statistics_grouped_frequency_weighted_mean');
    }
    if (/coordinate_geometry_point_to_plane_distance|point.?to.?plane|点到平面|法向量|normal vector/i.test(hint)) {
      used.add('geometry_coordinate_vector_distance_relation');
      used.add('spatial_multi_object_vector_angle_distance');
    }
    if (/spatial_line_plane_concept_judgement|line.?plane|线面|面面|平行|垂直/i.test(hint)) {
      used.add('geometry_condition_to_line_plane_relation');
      used.add('spatial_parameter_line_plane_condition');
    }
    if (/quadratic_function_properties|二次函数|对称轴|顶点|开口/i.test(hint)) {
      used.add('function_quadratic_parameter_property');
    }
    if (/function_monotonicity_parity_statement|monotonicity|parity|单调|奇偶|定义域|值域/i.test(hint)) {
      used.add('function_domain_range_monotonicity_combined');
      used.add('function_monotonicity_parity_counterexample');
    }
    if (/derivative_tangent_constraint|derivative|tangent|导数|切线/i.test(hint)) {
      used.add('function_derivative_tangent_parameter_constraint');
    }
    if (/probability_multi_event_counting|probability|概率|事件|排列|组合|计数/i.test(hint)) {
      used.add('probability_case_counting_with_condition');
      used.add('probability_multi_event_relation');
    }
    if (/rational_inequality_solution_boundary|不等式|inequality|解集|区间/i.test(hint)) {
      used.add('math_multi_constraint_algebraic_reasoning');
    }
    if (/conic_shared_focus_relation|椭圆|双曲线|圆锥曲线|conic/i.test(hint)) {
      used.add('math_parameter_case_analysis');
    }
  }
  return used;
}

export function mathProductionTaskFamilyPolicy(input: {
  target: MathProductionTaskFamilyTarget;
  rejectedCount: number;
  retryPressure: boolean;
  recentPatternHints?: string[];
  recentAcceptedPatternHints?: string[];
  recentAcceptedScenarioHints?: string[];
}): SubjectPracticeTaskFamilyPolicy {
  const hints = [
    ...(input.recentPatternHints ?? []),
    ...(input.recentAcceptedPatternHints ?? []),
    ...(input.recentAcceptedScenarioHints ?? [])
  ];
  const variants = MATH_PRODUCTION_TASK_FAMILY_VARIANTS.filter((item) => item.target === input.target);
  const usedVariants = mathProductionTaskFamilyUsedVariants(hints);
  const acceptedUsedVariants = mathProductionTaskFamilyUsedVariants(input.recentAcceptedPatternHints ?? []);
  const selectedVariant = variants.find((item) => !usedVariants.has(item.key))
    ?? variants.find((item) => !acceptedUsedVariants.has(item.key))
    ?? variants[Math.max(0, input.rejectedCount) % variants.length];
  const isHard = input.target.startsWith('hard_') || input.target === 'generic_hard_math';
  const isBasic = input.target.startsWith('basic_');
  const taskFamily = input.target === 'medium_sequence'
    ? 'medium_sequence_condition_reasoning'
    : input.target === 'basic_probability'
      ? 'basic_probability_finite_sample_calculation'
      : input.target === 'medium_probability'
        ? 'medium_probability_multi_event_or_normal_relation'
        : input.target === 'basic_normal_distribution'
          ? 'basic_normal_distribution_threshold_or_z_score'
          : input.target === 'medium_normal_distribution'
            ? 'medium_normal_distribution_standardization_relation'
            : input.target === 'hard_normal_distribution'
              ? 'hard_normal_distribution_inverse_standardization_relation'
              : input.target === 'basic_derivative'
                ? 'basic_derivative_direct_value_or_slope'
                : input.target === 'basic_sequence'
                  ? 'basic_sequence_direct_term_or_sum'
                  : input.target === 'basic_statistics'
                  ? 'basic_statistics_single_statistic_calculation'
                  : input.target === 'basic_function'
                    ? 'basic_function_direct_property_or_value'
                    : input.target === 'basic_elementary_function'
                      ? 'basic_elementary_function_direct_property_or_value'
                      : input.target === 'basic_geometry'
                        ? 'basic_geometry_direct_coordinate_metric'
                        : input.target === 'basic_vector_complex'
                          ? 'basic_vector_complex_direct_operation'
                          : input.target === 'hard_sequence'
                            ? 'hard_sequence_multi_constraint_reasoning'
                            : input.target === 'medium_statistics'
                              ? 'medium_statistics_two_statistic_reasoning'
                              : input.target === 'hard_statistics'
                                ? 'hard_statistics_multi_step_inference'
                                : input.target === 'medium_vector_complex'
                                  ? 'medium_vector_complex_relation_judgement'
                                  : input.target === 'medium_geometry'
                                    ? 'medium_geometry_coordinate_vector_reasoning'
                                    : input.target === 'hard_vector_complex'
                                      ? 'hard_vector_complex_multi_relation_reasoning'
                                      : input.target === 'hard_spatial'
                                        ? 'hard_spatial_multi_constraint_vector_reasoning'
                                        : input.target === 'medium_elementary_function'
                                          ? 'medium_elementary_function_exp_log_relation'
                                          : input.target === 'hard_elementary_function'
                                            ? 'hard_elementary_function_parameter_or_inequality'
                                            : input.target === 'medium_function'
                                              ? 'medium_function_property_combination'
                                              : input.target === 'hard_function'
                                                ? 'hard_function_parameter_or_counterexample_reasoning'
                                                : input.target === 'hard_probability'
                                                  ? 'hard_probability_multi_event_counting'
                                                  : 'hard_math_multi_constraint_reasoning';
  return {
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    taskFamily,
    selectedVariant: selectedVariant.key,
    selectedVariantLabel: selectedVariant.label,
    requiredReasoningMoves: selectedVariant.requiredMoves,
    bannedMediumShortcut: selectedVariant.bannedShortcut,
    difficultyRubric: isHard
      ? [
        'hard math requires at least two linked constraints or a non-obvious intermediate result',
        'hard math must include parameter reasoning, case analysis, multi-object geometry, multi-event counting, derivative/tangent constraints, or proof-style elimination',
        'hard math cannot be a direct concept statement list, one formula substitution, or transparent two-equation solve',
        'hard explanation must show the intermediate relation or case split before the final answer'
      ]
      : isBasic
        ? [
          'basic math should stay short and concrete with one visible calculation or one directly evidenced property',
          'basic probability must compute a probability in a finite equally likely sample space instead of only naming classical-probability conditions',
          'basic derivative must use one derivative value, tangent slope, or one interval sign judgement instead of a piecewise, parameter, or multi-condition system',
          'basic sequence/statistics/function/geometry/vector-complex cells must expose the single formula, data set, coordinate, expression, or operation needed for verification',
          'basic explanation should show the single computation or single rule application'
        ]
        : [
          'medium math requires at least two visible reasoning moves or one condition transformation before calculation',
          'medium math should combine two facts such as domain plus range, missing value plus variance, vector relation plus distance, or sequence condition plus property',
          'medium math cannot be one-step arithmetic, a bare formula lookup, or a direct mean-total subtraction shell',
          'medium explanation must show both the setup and the second decision/calculation'
        ],
    retryPressure: input.retryPressure
  };
}

export function chemistryProductionTaskFamilyPolicy(input: {
  target: ChemistryProductionTaskFamilyTarget;
  rejectedCount: number;
  retryPressure: boolean;
  recentPatternHints?: string[];
  recentAcceptedPatternHints?: string[];
  recentAcceptedScenarioHints?: string[];
  recentDeliveryFailedPatternHints?: string[];
}): SubjectPracticeTaskFamilyPolicy {
  const hints = [
    ...(input.recentPatternHints ?? []),
    ...(input.recentAcceptedPatternHints ?? []),
    ...(input.recentAcceptedScenarioHints ?? [])
  ];
  const variants = CHEMISTRY_PRODUCTION_TASK_FAMILY_VARIANTS.filter((item) => item.target === input.target);
  const usedVariants = chemistryProductionTaskFamilyUsedVariants(hints);
  const acceptedUsedVariants = chemistryProductionTaskFamilyUsedVariants(input.recentAcceptedPatternHints ?? []);
  const deliveryCooldownVariants = Array.from(chemistryProductionTaskFamilyUsedVariants(input.recentDeliveryFailedPatternHints ?? []))
    .filter((variant) => variants.some((item) => item.key === variant));
  const deliveryCooldownSet = new Set(deliveryCooldownVariants);
  const viableVariants = variants.some((item) => !deliveryCooldownSet.has(item.key))
    ? variants.filter((item) => !deliveryCooldownSet.has(item.key))
    : variants;
  const selectedVariant = viableVariants.find((item) => !usedVariants.has(item.key))
    ?? viableVariants.find((item) => !acceptedUsedVariants.has(item.key))
    ?? viableVariants[Math.max(0, input.rejectedCount) % viableVariants.length];
  return {
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    taskFamily: input.target === 'medium_periodic'
      ? 'medium_periodic_trend_evidence_discrimination'
      : input.target === 'hard_periodic'
        ? 'hard_periodic_multi_constraint_calculation'
        : 'hard_bond_data_anomaly_calculation',
    selectedVariant: selectedVariant.key,
    selectedVariantLabel: selectedVariant.label,
    requiredReasoningMoves: selectedVariant.requiredMoves,
    bannedMediumShortcut: selectedVariant.bannedShortcut,
    difficultyRubric: input.target === 'medium_periodic'
      ? [
        'medium requires two visible periodic clues or observations',
        'medium answer must combine both clues rather than restating one trend',
        'medium must separate halogen displacement from metal-activity displacement',
        'medium explanation must name the trend used for each clue'
      ]
      : input.target === 'hard_periodic'
        ? [
          'hard requires identity inference plus a separate property or exception conclusion',
          'hard stem must contain at least two independent constraints',
          'hard answer cannot be reached from named-element trend recall alone',
          'hard explanation must show the elimination or exception step before ranking'
        ]
        : [
          'hard requires numeric data comparison plus bond or intermolecular-force interpretation',
          'hard answer must depend on at least two force or structure factors',
        'hard cannot be a single conductivity, melting-point, or hydrogen-bond recall item',
        'hard explanation must connect the computed comparison to the force model'
      ],
    ...(deliveryCooldownVariants.length
      ? {
        deliveryCooldownVariants: deliveryCooldownVariants.slice(0, 4),
        deliveryFailurePolicy: 'deprioritize_for_delivery_only_not_quality_memory' as const
      }
      : {}),
    retryPressure: input.retryPressure
  };
}

export function hardEquilibriumTaskFamilyPolicy(input: {
  rejectedCount: number;
  retryPressure: boolean;
  recentPatternHints?: string[];
  recentAcceptedPatternHints?: string[];
  recentDeliveryFailedPatternHints?: string[];
}): SubjectPracticeTaskFamilyPolicy {
  const hints = [
    ...(input.recentPatternHints ?? []),
    ...(input.recentAcceptedPatternHints ?? [])
  ];
  const usedVariants = hardEquilibriumUsedVariants(hints);
  const acceptedUsedVariants = hardEquilibriumUsedVariants(input.recentAcceptedPatternHints ?? []);
  const deliveryCooldownVariants = Array.from(hardEquilibriumUsedVariants(input.recentDeliveryFailedPatternHints ?? []))
    .filter((variant) => HARD_EQUILIBRIUM_VARIANTS.some((item) => item.key === variant));
  const deliveryCooldownSet = new Set(deliveryCooldownVariants);
  const viableVariants = HARD_EQUILIBRIUM_VARIANTS.some((item) => !deliveryCooldownSet.has(item.key))
    ? HARD_EQUILIBRIUM_VARIANTS.filter((item) => !deliveryCooldownSet.has(item.key))
    : HARD_EQUILIBRIUM_VARIANTS;
  const selectedVariant = viableVariants.find((item) => !usedVariants.has(item.key))
    ?? viableVariants.find((item) => !acceptedUsedVariants.has(item.key))
    ?? viableVariants[Math.max(0, input.rejectedCount) % viableVariants.length];
  return {
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    taskFamily: 'hard_equilibrium_multi_constraint_application',
    selectedVariant: selectedVariant.key,
    selectedVariantLabel: selectedVariant.label,
    requiredReasoningMoves: selectedVariant.requiredMoves,
    bannedMediumShortcut: selectedVariant.bannedShortcut,
    difficultyRubric: [
      'hard requires at least two linked chemistry reasoning moves visible in stem and explanation',
      'hard requires a final answer with at least two independently checkable conclusions',
      'hard cannot be solved by one direct Le Chatelier rule, one direct Q/K comparison, or catalyst no-shift recall',
      'hard explanation must name the intermediate comparison before applying the final equilibrium/rate conclusion'
    ],
    ...(deliveryCooldownVariants.length
      ? {
        deliveryCooldownVariants: deliveryCooldownVariants.slice(0, 4),
        deliveryFailurePolicy: 'deprioritize_for_delivery_only_not_quality_memory' as const
      }
      : {}),
    retryPressure: input.retryPressure
  };
}

export function basicChemistryObservationTaskFamilyPolicy(input: {
  topic: BasicChemistryObservationTopic;
  rejectedCount: number;
  retryPressure: boolean;
  recentPatternHints?: string[];
  recentAcceptedPatternHints?: string[];
  recentDeliveryFailedPatternHints?: string[];
}): SubjectPracticeTaskFamilyPolicy {
  const hints = [
    ...(input.recentPatternHints ?? []),
    ...(input.recentAcceptedPatternHints ?? [])
  ];
  const topicVariants = BASIC_CHEMISTRY_OBSERVATION_VARIANTS.filter((item) => item.topic === input.topic);
  const usedVariants = basicChemistryObservationUsedVariants(hints);
  const acceptedUsedVariants = basicChemistryObservationUsedVariants(input.recentAcceptedPatternHints ?? []);
  const deliveryCooldownVariants = Array.from(basicChemistryObservationUsedVariants(input.recentDeliveryFailedPatternHints ?? []))
    .filter((variant) => topicVariants.some((item) => item.key === variant));
  const deliveryCooldownSet = new Set(deliveryCooldownVariants);
  const viableVariants = topicVariants.some((item) => !deliveryCooldownSet.has(item.key))
    ? topicVariants.filter((item) => !deliveryCooldownSet.has(item.key))
    : topicVariants;
  const selectedVariant = viableVariants.find((item) => !usedVariants.has(item.key))
    ?? viableVariants.find((item) => !acceptedUsedVariants.has(item.key))
    ?? viableVariants[Math.max(0, input.rejectedCount) % viableVariants.length];
  return {
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    taskFamily: input.topic === 'periodic'
      ? 'basic_periodic_observation_judgement'
      : 'basic_bond_property_observation_judgement',
    selectedVariant: selectedVariant.key,
    selectedVariantLabel: selectedVariant.label,
    requiredReasoningMoves: selectedVariant.requiredMoves,
    bannedMediumShortcut: selectedVariant.bannedShortcut,
    difficultyRubric: [
      'basic requires exactly one concrete observation or property in the stem',
      'basic requires exactly one direct concept-to-observation conclusion',
      'basic must keep reading load low: no hidden multi-condition inference, no three-or-more object ranking, and no broad correct-statement list',
      'basic explanation should be one direct application plus one brief misconception contrast'
    ],
    ...(deliveryCooldownVariants.length
      ? {
        deliveryCooldownVariants: deliveryCooldownVariants.slice(0, 4),
        deliveryFailurePolicy: 'deprioritize_for_delivery_only_not_quality_memory' as const
      }
      : {}),
    retryPressure: input.retryPressure
  };
}
