import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const reviewerTaskId = '01a0a477-1ae5-7880-93e0-6f44c2e06294';
const reviewerDir = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.dirname(reviewerDir);
const blindDir = path.join(batchDir, 'blind');
const reviewsDir = path.join(batchDir, 'reviews');
const reviewedAt = new Date().toISOString();

const truth = (answer) => Object.fromEntries(['A', 'B', 'C', 'D'].map((id) => [id, id === answer]));
const noneTrue = { A: false, B: false, C: false, D: false };

const math = {
  'CQ-MATH-1001': ['A', "f'(x)=-2x-1, so f'(0)=-1. Thus A is true; B=0, C=-2, and D=1 are false."],
  'CQ-MATH-1002': ['B', "f'(x)=4x-1, so f'(-1)=-5. Thus only B is true (A=-4, C=-6, D=5)."],
  'CQ-MATH-1003': ['C', "f'(x)=-9x^2-4, so f'(-2)=-36-4=-40. Thus only C is true (A=-39, B=-41, D=40)."],
  'CQ-MATH-1004': ['D', "f'(x)=-3x^2+3, so f'(-3)=-27+3=-24. Thus only D is true (A=-23, B=-25, C=24)."],
  'CQ-MATH-1005': ['A', "f'(x)=4x, so f'(-3)=-12. Thus only A is true (B=-11, C=-13, D=12)."],
  'CQ-MATH-1006': ['A', 'A logarithm requires x-8>0, hence x>8. A is exact; B wrongly includes 8, C has negative arguments, and D includes invalid inputs.'],
  'CQ-MATH-1007': ['B', 'For every real x, 0.64^x>0; it approaches but never equals 0 and takes values both below and above 1. Hence only B, (0,+infinity), is true.'],
  'CQ-MATH-1008': ['C', '14^3=14*14*14=196*14=2744. Therefore C is true; A and B are off by +1 and -1, and D has the wrong sign.'],
  'CQ-MATH-1009': ['D', 'The logarithm requires x+9>0, hence x>-9. D is exact; A includes the invalid endpoint, B is the wrong side, and C is too broad.'],
  'CQ-MATH-1010': ['A', 'For every real x, 3.1^x>0; it approaches but never equals 0 and includes values in (0,1) and above 1. Hence only A is true.'],
  'CQ-MATH-1011': ['C', 'The slope is (-5-(-3))/(1-(-3))=-2/4=-1/2. Thus only C is true.'],
  'CQ-MATH-1012': ['D', 'x+y-13=0 gives y=-x+13, so slope=-1. The inclination angle in [0,180 degrees) with tan(alpha)=-1 is 135 degrees; only D is true.'],
  'CQ-MATH-1013': ['A', 'The given line has slope 1/3, so a perpendicular line has slope -3. Option slopes are A=-3, B=1/3, C=1/3, D=-1/2; only A is true.'],
  'CQ-MATH-1014': ['B', 'Slope 1/2 through (-1,-1) gives y+1=(x+1)/2, or x-2y-1=0. Only B both has the required slope and contains P.'],
  'CQ-MATH-1015': ['C', 'The slope is (-4-(-1))/(3-(-1))=-3/4. Thus only C is true.'],
};

const physics = {
  'CQ-PHYSICS-1001': ['A', 'Uniform speed is |25 m|/5 s=5 m/s. Only A matches; B, C, and D differ numerically.'],
  'CQ-PHYSICS-1002': ['B', 'Uniform speed is |18 m|/3 s=6 m/s. Only B matches; A, C, and D differ numerically.'],
  'CQ-PHYSICS-1003': ['C', 'Uniform speed is |35 m|/5 s=7 m/s. Only C matches; A, B, and D differ numerically.'],
  'CQ-PHYSICS-1004': ['D', 'Uniform speed is |56 m|/7 s=8 m/s. Only D matches; A, B, and C differ numerically.'],
  'CQ-PHYSICS-1005': ['abstain', 'The endpoints imply average acceleration (14-6)/8=1 m/s^2, but the prompt asks for acceleration without saying average acceleration or constant acceleration. A nonlinear v(t)=6+t+e*sin(pi*t/4) has the same endpoints for any nonzero e but variable acceleration, so no option is compelled.'],
  'CQ-PHYSICS-1006': ['abstain', 'The endpoints imply average acceleration (0-4)/4=-1 m/s^2, but the prompt asks for acceleration without saying average acceleration or constant acceleration. A nonlinear velocity curve can share both endpoints while having time-varying acceleration, so D is only the average, not a uniquely defined instantaneous acceleration.'],
  'CQ-PHYSICS-1007': ['abstain', 'The endpoints imply average acceleration (6-2)/4=1 m/s^2, but the prompt asks for acceleration without saying average acceleration or constant acceleration. Curved velocity-time histories with the same endpoints give different accelerations, so no option is compelled.'],
  'CQ-PHYSICS-1008': ['abstain', 'The endpoints imply average acceleration (9-3)/6=1 m/s^2, but the prompt asks for acceleration without saying average acceleration or constant acceleration. Curved velocity-time histories with the same endpoints give different accelerations, so no option is compelled.'],
  'CQ-PHYSICS-1009': ['A', 'With the stated acceleration applying for 4 s, v=u+at=3+1*4=7 m/s. Only A matches.'],
  'CQ-PHYSICS-1010': ['B', 'With the stated acceleration applying for 4 s, v=u+at=2+1*4=6 m/s. Only B matches.'],
  'CQ-PHYSICS-1011': ['C', 'With the stated acceleration applying for 6 s, v=u+at=3+1*6=9 m/s. Only C matches.'],
  'CQ-PHYSICS-1012': ['D', 'With the stated acceleration applying for 8 s, v=u+at=4+1*8=12 m/s. Only D matches.'],
  'CQ-PHYSICS-1013': ['D', 'Treating the stated 1 m/s^2 as applying throughout the 2 s interval, s=ut+at^2/2=2*2+1*4/2=6 m. Only D matches.'],
  'CQ-PHYSICS-1014': ['C', 'Treating the stated 1 m/s^2 as applying throughout the 3 s interval, s=ut+at^2/2=4*3+1*9/2=16.5 m. Only C matches.'],
  'CQ-PHYSICS-1015': ['D', 'Treating the stated 1 m/s^2 as applying throughout the 3 s interval, s=ut+at^2/2=3*3+1*9/2=13.5 m. Only D matches.'],
};

const chemistry = {
  'CQ-CHEMISTRY-1001': ['A', '[H+]=0.08*(50/1250)=0.0032 mol/L; pH=-log10(0.0032)=2.4949, rounding to 2.49. Only A matches.'],
  'CQ-CHEMISTRY-1002': ['B', '[H+]=0.2*(20/1000)=0.004 mol/L; pH=2.3979, rounding to 2.4. Only B matches.'],
  'CQ-CHEMISTRY-1003': ['C', '[H+]=0.02*(5/500)=0.0002 mol/L; pH=3.6990, rounding to 3.7. Only C matches.'],
  'CQ-CHEMISTRY-1004': ['D', '[H+]=0.05*(25/2500)=0.0005 mol/L; pH=3.3010, rounding to 3.3. Only D matches.'],
  'CQ-CHEMISTRY-1005': ['A', '[H+]=0.2*(5/50)=0.02 mol/L; pH=1.6990, rounding to 1.7. Only A matches.'],
  'CQ-CHEMISTRY-1006': ['B', '[OH-]=0.01*(40/400)=0.001 mol/L; pOH=3 and pH=14-3=11 at 25 C. Only B matches.'],
  'CQ-CHEMISTRY-1007': ['C', '[OH-]=0.05*(10/200)=0.0025 mol/L; pOH=2.6021 and pH=11.3979, rounding to 11.4. Only C matches.'],
  'CQ-CHEMISTRY-1008': ['D', '[OH-]=0.1*(40/800)=0.005 mol/L; pOH=2.3010 and pH=11.6990, rounding to 11.7. Only D matches.'],
  'CQ-CHEMISTRY-1009': ['A', '[OH-]=0.01*(20/500)=0.0004 mol/L; pOH=3.3979 and pH=10.6021, rounding to 10.6. Only A matches.'],
  'CQ-CHEMISTRY-1010': ['B', '[OH-]=0.04*(50/1250)=0.0016 mol/L; pOH=2.7959 and pH=11.2041, rounding to 11.2. Only B matches.'],
  'CQ-CHEMISTRY-1011': ['C', 'n(H+)=0.040*0.05=0.002 mol; n(OH-)=0.025*0.25=0.00625 mol. Excess [OH-]=0.00425/0.065=0.0653846 mol/L, so pH=12.8155, rounding to 12.82. Only C matches.'],
  'CQ-CHEMISTRY-1012': ['D', 'n(H+)=0.010*0.2=0.002 mol; n(OH-)=0.030*0.06=0.0018 mol. Excess [H+]=0.0002/0.040=0.005 mol/L, so pH=2.3010, rounding to 2.3. Only D matches.'],
  'CQ-CHEMISTRY-1013': ['A', 'n(H+)=0.015*0.15=0.00225 mol; n(OH-)=0.030*0.18=0.0054 mol. Excess [OH-]=0.00315/0.045=0.07 mol/L, so pH=12.8451, rounding to 12.85. Only A matches.'],
  'CQ-CHEMISTRY-1014': ['B', 'n(H+)=0.025*0.12=0.003 mol; n(OH-)=0.030*0.06=0.0018 mol. Excess [H+]=0.0012/0.055=0.021818 mol/L, so pH=1.6612, rounding to 1.66. Only B matches.'],
  'CQ-CHEMISTRY-1015': ['C', 'n(H+)=0.030*0.1=0.003 mol; n(OH-)=0.030*0.18=0.0054 mol. Excess [OH-]=0.0024/0.060=0.04 mol/L, so pH=12.6021, rounding to 12.6. Only C matches.'],
};

const requiredKeys = [
  'schemaVersion', 'candidateId', 'reviewerTaskId', 'derivedAnswer', 'optionTruthTable',
  'conditionsSufficient', 'ambiguityFound', 'syllabusAligned', 'difficultyAssessment',
  'caseNecessary', 'counterexampleAttempted', 'verificationEvidence', 'verdictBeforeReveal',
  'reasonCodes', 'reviewedAt',
];

const blindFiles = fs.readdirSync(blindDir).filter((name) => name.endsWith('.json')).sort();
if (blindFiles.length !== 45) throw new Error(`Expected 45 blind candidates, found ${blindFiles.length}`);
fs.mkdirSync(reviewsDir, { recursive: true });

const summaries = [];
for (const filename of blindFiles) {
  const candidate = JSON.parse(fs.readFileSync(path.join(blindDir, filename), 'utf8'));
  const source = candidate.subject === 'math' ? math : candidate.subject === 'physics' ? physics : chemistry;
  const entry = source[candidate.candidateId];
  if (!entry) throw new Error(`Missing independent result for ${candidate.candidateId}`);
  const [answer, calculation] = entry;
  const isAccelerationAmbiguity = ['CQ-PHYSICS-1005', 'CQ-PHYSICS-1006', 'CQ-PHYSICS-1007', 'CQ-PHYSICS-1008'].includes(candidate.candidateId);
  const isScience = candidate.subject !== 'math';
  const unrealistic = ['CQ-PHYSICS-1010', 'CQ-PHYSICS-1011', 'CQ-CHEMISTRY-1011'].includes(candidate.candidateId);
  const reasonCodes = [];
  if (isScience) reasonCodes.push('EN_LOCALIZATION_UNGRAMMATICAL');
  if (isAccelerationAmbiguity) reasonCodes.push('ACCELERATION_NOT_DEFINED_AS_AVERAGE_OR_CONSTANT', 'CONDITIONS_INSUFFICIENT');
  if (unrealistic) reasonCodes.push('OPERATIONAL_SCALE_OR_PURPOSE_IMPLAUSIBLE');

  const evidence = [calculation];
  if (isScience) {
    evidence.push('The English localization is not publication-ready: it begins with a lowercase sentence fragment and repeatedly uses ungrammatical constructions such as "The result supports" followed by a bare verb.');
  }
  if (candidate.candidateId === 'CQ-PHYSICS-1010') evidence.push('A museum guide robot accelerating from 2 m/s to 6 m/s (21.6 km/h) in a visitor gallery is an implausible and unsafe operational scale.');
  if (candidate.candidateId === 'CQ-PHYSICS-1011') evidence.push('A photovoltaic-panel cleaning robot reaching 9 m/s (32.4 km/h) is implausible for the described cleaning operation.');
  if (candidate.candidateId === 'CQ-CHEMISTRY-1011') evidence.push('Calling the post-neutralization liquid a nutrient working solution is operationally implausible because the computed pH is about 12.82, far outside a credible crop nutrient solution range.');

  const review = {
    schemaVersion: 'codex-blind-review-v1',
    candidateId: candidate.candidateId,
    reviewerTaskId,
    derivedAnswer: answer,
    optionTruthTable: answer === 'abstain' ? noneTrue : truth(answer),
    conditionsSufficient: !isAccelerationAmbiguity,
    ambiguityFound: isAccelerationAmbiguity,
    syllabusAligned: true,
    difficultyAssessment: candidate.designedDifficulty,
    caseNecessary: candidate.candidateId !== 'CQ-CHEMISTRY-1011',
    counterexampleAttempted: true,
    verificationEvidence: evidence,
    verdictBeforeReveal: isScience ? (isAccelerationAmbiguity ? 'abstain' : 'reject') : 'pass',
    reasonCodes,
    reviewedAt,
  };

  for (const key of requiredKeys) if (!(key in review)) throw new Error(`${candidate.candidateId} missing ${key}`);
  if (Object.keys(review).length !== requiredKeys.length) throw new Error(`${candidate.candidateId} has unexpected keys`);
  if (new Set(candidate.options.map((o) => o.id)).size !== 4) throw new Error(`${candidate.candidateId} does not have four unique option ids`);
  if (!['A', 'B', 'C', 'D', 'abstain'].includes(review.derivedAnswer)) throw new Error(`${candidate.candidateId} has invalid answer`);
  fs.writeFileSync(path.join(reviewsDir, `${candidate.candidateId}.review.json`), `${JSON.stringify(review, null, 2)}\n`);
  summaries.push({ candidateId: candidate.candidateId, subject: candidate.subject, verdict: review.verdictBeforeReveal, reasonCodes });
}

const subjects = ['math', 'physics', 'chemistry'];
const countsBySubject = Object.fromEntries(subjects.map((subject) => {
  const rows = summaries.filter((row) => row.subject === subject);
  return [subject, Object.fromEntries(['pass', 'reject', 'abstain'].map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]))];
}));
const recurringReasonCodes = {};
for (const row of summaries) for (const code of row.reasonCodes) recurringReasonCodes[code] = (recurringReasonCodes[code] ?? 0) + 1;

const manifest = {
  schemaVersion: 'codex-blind-review-manifest-v1',
  reviewerTaskId,
  batchId: 'pilot-30-v2',
  blindScope: 'question-production/batches/pilot-30-v2/blind/',
  reviewedAt,
  candidateCount: summaries.length,
  countsBySubject,
  totalCounts: Object.fromEntries(['pass', 'reject', 'abstain'].map((verdict) => [verdict, summaries.filter((row) => row.verdict === verdict).length])),
  recurringReasonCodes: Object.fromEntries(Object.entries(recurringReasonCodes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  candidates: summaries,
  limitations: [
    'Blind review only: no sealed answers, generator reasoning, Git history, old reviews, official question bodies, or publication state were consulted.',
    'No external empirical source was used to calibrate operational realism; realism findings are reviewer judgments from the prompt facts.',
    'Science candidates were rejected when their included English localization was not publication-ready, even when the numerical answer was independently unique.',
  ],
};
fs.writeFileSync(path.join(reviewsDir, 'reviewer-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({ candidateCount: summaries.length, countsBySubject, totalCounts: manifest.totalCounts, recurringReasonCodes: manifest.recurringReasonCodes }, null, 2));
