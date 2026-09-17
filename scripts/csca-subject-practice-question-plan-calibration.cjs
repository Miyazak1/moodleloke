const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const {
  subjectPracticeClassifyTaskFamily
} = require('../backend/src/ai-questioning/subject-practice-task-family-policy');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor,
  subjectPracticeQuestionPlanSupportsTaskFamily
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL=/.test(item));
  if (!line) return;
  process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, '').trim().replace(/^"|"$/g, '');
}

const TERMS = {
  operations: ['\u52a0\u70ed', '\u91cf\u53d6', '\u79f0\u91cf', '\u7a00\u91ca', '\u8bfb\u53d6', '\u6ef4\u52a0', '\u8f6c\u5165', '\u51b7\u5374', '\u6405\u62cc', '\u9884\u70ed', '\u6d17\u6da4', '\u8fc7\u6ee4', '\u84b8\u998f', '\u8403\u53d6', '\u632f\u8361', '\u8865\u52a0', '\u5939\u6301', '\u5012\u5165', '\u6ce8\u5165'],
  observations: ['\u89c2\u5bdf', '\u73b0\u8c61', '\u98de\u6e85', '\u53d8\u8272', '\u6c89\u6dc0', '\u6c14\u6ce1', '\u70eb\u624b', '\u53d1\u70ed', '\u892a\u8272', '\u94f6\u955c', '\u653e\u51fa', '\u751f\u6210', '\u589e\u91cd'],
  hypotheses: ['\u539f\u56e0', '\u4e3b\u56e0', '\u8bf4\u660e', '\u5bf9\u6bd4', '\u6392\u9664', '\u5047\u8bbe', '\u63a2\u7a76', '\u7ade\u4e89', '\u63a7\u5236\u53d8\u91cf', '\u53cd\u8bc1'],
  directRules: ['\u6b63\u786e\u7684\u662f', '\u7b26\u5408\u89c4\u8303', '\u4e0d\u5bf9\u7740', '\u4e0d\u80fd', '\u5e94', '\u9519\u8bef', '\u5b89\u5168\u89c4\u8303'],
  reasoning: ['\u7531', '\u7ed3\u5408', '\u8bf4\u660e', '\u6392\u9664', '\u56e0\u6b64', '\u6545', '\u53ef\u5f97', '\u63a8\u5f97', '\u8bc1\u660e', '\u540c\u65f6\u6ee1\u8db3', '\u5bf9\u6bd4'],
  quantitativeChinese: ['\u76f8\u5bf9\u5206\u5b50\u8d28\u91cf', '\u8d28\u91cf\u5206\u6570', '\u71c3\u70e7', '\u500d'],
  reactionChinese: ['\u78b3\u9178\u6c22\u94a0', '\u6eb4', '\u94f6\u955c', '\u4e0e\u94a0', '\u916f\u5316', '\u6c34\u89e3', '\u9ad8\u9530\u9178\u94be', '\u892a\u8272'],
  gasControl: ['\u9664\u6742', '\u5e72\u71e5', '\u6536\u96c6', '\u9a8c\u6ee1', '\u68c0\u9a8c', '\u5c3e\u6c14', '\u6d17\u6c14', '\u6392\u7a7a\u6c14', '\u6392\u6c34', '\u9664\u53bb', '\u6d53\u786b\u9178', '\u78b1\u77f3\u7070', '\u77f3\u7070\u6c34', '\u6e7f\u6da6', '\u77f3\u854a'],
  redoxConcepts: ['\u6c27\u5316\u8fd8\u539f', '\u7535\u5b50\u8f6c\u79fb', '\u8f6c\u79fb\u7535\u5b50', '\u5316\u5408\u4ef7', '\u4ef7\u6001', '\u6c27\u5316\u5242', '\u8fd8\u539f\u5242', '\u88ab\u6c27\u5316', '\u88ab\u8fd8\u539f', '\u6c27\u5316\u4e3a', '\u8fd8\u539f\u4e3a', '\u914d\u5e73', '\u7cfb\u6570'],
  redoxQuantChain: ['\u7269\u8d28\u7684\u91cf', '\u8f6c\u79fb\u7535\u5b50', '\u7535\u5b50\u6570', '\u6469\u5c14', '\u6bd4\u4e3a', '\u4e4b\u6bd4', '\u5b8c\u5168\u53cd\u5e94', '\u6070\u597d', '\u8fc7\u91cf', '\u8017\u5c3d', '\u6d88\u8017', '\u751f\u6210', '\u6807\u51c6\u72b6\u51b5']
};

function countTerms(text, terms) {
  return terms.reduce((sum, term) => sum + text.split(term).length - 1, 0);
}

function countRegex(text, pattern) {
  return (text.match(pattern) || []).length;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function qualityAuditDisplayReason(value) {
  const reason = cleanText(value);
  if (reason === 'gate_decision_human_review') return 'gate_decision_needs_quality_attention';
  if (reason === 'reviewer_human_review') return 'reviewer_needs_quality_attention';
  if (reason === 'replacement_requires_human_review') return 'replacement_requires_quality_attention';
  if (reason === 'variant_requires_human_review') return 'variant_requires_quality_attention';
  return reason;
}

function candidateFeatures(row) {
  const text = `${row.prompt || ''}\n${row.explanation || ''}\n${JSON.stringify(row.options || [])}`;
  return {
    operationWords: countTerms(text, TERMS.operations),
    observationWords: countTerms(text, TERMS.observations),
    quantitativeMarkers: countRegex(text, /(\d+(?:\.\d+)?\s*(?:mL|mol|g|L|%)|CO2|H2O|NaHCO3|Br2|H2|O2)/gi) + countTerms(text, TERMS.quantitativeChinese),
    reactionClues: countRegex(text, /(NaHCO3|Br2|Na|KMnO4|CCl4|CO2|H2)/gi) + countTerms(text, TERMS.reactionChinese),
    hypothesisMarkers: countTerms(text, TERMS.hypotheses),
    directRuleMarkers: countTerms(text, TERMS.directRules),
    reasoningConnectors: countTerms(text, TERMS.reasoning),
    gasSpeciesMarkers: countRegex(text, /(Cl2|Cl\u2082|NH3|NH\u2083|CO2|CO\u2082|O2|O\u2082|H2|H\u2082|SO2|SO\u2082|NO2|NO\u2082|NO|HCl)/gi),
    gasControlMarkers: countTerms(text, TERMS.gasControl),
    redoxReactionMarkers: countRegex(text, /(Fe|Cu|Pb|MnO2|MnO\u2082|Cl2|Cl\u2082|H2S|H\u2082S|SO2|SO\u2082|I2|I\u2082|Br2|Br\u2082|KMnO4|KMnO\u2084|KClO3|KClO\u2083|H2SO4|H\u2082SO\u2084|HCl|e[-\u2212])/gi),
    redoxConceptMarkers: countTerms(text, TERMS.redoxConcepts),
    redoxQuantitativeChainMarkers: countRegex(text, /(\d+(?:\.\d+)?\s*(?:mol|mmol|mL|L)|mol\s*[A-Za-z]|e[-\u2212]|n\s*\(|V\/n|\/n|\u2192|\u2191|>|<)/gi)
      + countTerms(text, TERMS.redoxQuantChain),
    phConceptMarkers: countRegex(text, /(pH|pOH|H[+⁺]|OH[-−⁻]|氢离子|氢氧根|酸性|碱性|酸碱|浓度|稀释)/gi),
    phOperationErrorMarkers: countRegex(text, /(pH\s*试纸|容量瓶|移液管|量筒|滴定管|刻度线|定容|润湿|洗涤|仰视|俯视|残留|转移|配制|测定|volumetric|pipette|burette|meniscus|wet(?:ted|ting)?|rinse|prepar(?:e|ation)|measure(?:ment)?)/gi),
    phDirectionMarkers: countRegex(text, /(偏高|偏低|升高|降低|增大|减小|变大|变小|体积偏|浓度偏|稀释|higher|lower|increase|decrease|dilut)/gi)
  };
}

function mathCandidateFeatures(row) {
  const text = `${row.prompt || ''}\n${row.explanation || ''}\n${JSON.stringify(row.options || [])}`;
  const promptOnly = cleanText(row.prompt || '');
  const promptAndExplanation = `${row.prompt || ''}\n${row.explanation || ''}`;
  const lower = text.toLowerCase();
  const propertySignals = [
    /定义域|domain/.test(lower),
    /(根式|根号|分母|不为\s*0|不能为\s*0|不等于\s*0|√|sqrt|radical|denominator)/i.test(text),
    /值域|range/.test(lower),
    /单调|递增|递减|monotonic|increasing|decreasing/.test(lower),
    /奇偶|奇函数|偶函数|对称|symmetry|parity|odd function|even function/.test(lower),
    /周期|period/.test(lower),
    /最大值|最小值|极值|maximum|minimum|extremum/.test(lower)
  ].filter(Boolean).length;
  const transformationSignals = [
    /代入|定义|比较|排除|结合|合并|分组|加权|标准化|转化|列式|联立|因此|故|可得|because|therefore|combine|standardize|transform|compare|exclude/.test(lower),
    /f\(-?x\)|f\s*\(\s*-x\s*\)|奇函数|偶函数|对称/.test(lower),
    /导数|配方|判别式|图像|区间|derivative|complete square|discriminant|graph|interval/.test(lower)
  ].filter(Boolean).length;
  const hasExplicitParameterWord = /(参数|parameter)/i.test(promptAndExplanation);
  const probabilityEventLabelCount = countRegex(promptAndExplanation, /事件\s*[ABCD]|事件[一二三四]|event\s*[ABCD]|p\s*\(\s*[ABCD]|(?:^|[；;。:：\s])(?:[ABCD])\s*[:：]/gi);
  const probabilityNormalHardInteractionCueCount = countRegex(promptAndExplanation, /(双尾|单尾|尾概率|分位数|反标准化|标准化|对称性|标准正态分布函数|Φ\s*\(|z\s*=|均值\s*[μmu]|标准差\s*[σsigma]|求.{0,12}(?:均值|标准差|μ|σ)|低于.{0,24}占.{0,80}高于.{0,24}占|高于.{0,24}占.{0,80}低于.{0,24}占|two[- ]?tail|one[- ]?tail|tail probability|quantile|inverse standardi[sz]ation|standardi[sz]ation|symmetry|standard normal|z[-_ ]?score|mean.{0,20}standard deviation|standard deviation.{0,20}mean)/gi);
  const probabilityHardInteractionCueCount = countRegex(promptAndExplanation, /(分类|分情况|情况[一二三四]|按.{0,12}分类|补事件|补集|条件概率|给定|交集|并集|互斥|独立|限制|不放回.{0,20}(?:顺序|依次|先|后)|case split|complement|conditional|given|intersection|union|mutually exclusive|independent|restriction)/gi)
    + probabilityNormalHardInteractionCueCount;
  const probabilitySingleResultRisk = /概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score/i.test(text)
    && probabilityEventLabelCount < 2
    && probabilityHardInteractionCueCount < 1
    && /(概率是多少|概率为多少|求.{0,8}概率|what is.{0,20}probability|probability.{0,20}of)/i.test(promptAndExplanation);
  const probabilityEventListOnlyRisk = /概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score/i.test(text)
    && probabilityEventLabelCount >= 3
    && probabilityHardInteractionCueCount < 1
    && !/(分别计数|分别统计|联立|交集|并集|条件概率|补事件|分类|分情况|calculate p|compute p|case split|intersection|conditional|complement)/i.test(promptAndExplanation);
  const probabilityConcreteFrameSignals = countRegex(promptAndExplanation, /([0-9０-９]\s*个|[0-9０-９]\s*张|[0-9０-９]\s*次|[0-9０-９]\s*名|袋中|盒中|球|骰子|硬币|扑克牌|编号|随机抽取|无放回|有放回|掷|取出|从.{0,20}中|共有|总数|样本空间为|N\s*\(|normal\s*\(|z\s*=|Φ\s*\()/gi);
  const probabilityNormalMediumNoEventRisk = /(正态分布|标准正态|N\s*\(|normal distribution|standard normal|Φ\s*\()/i.test(promptAndExplanation)
    && /(说法|判断|正确|下列|which statement|correct)/i.test(promptAndExplanation)
    && !/(P\s*\(|概率|大于|小于|高于|低于|超过|不超过|介于|之间|落在|至少|至多|z\s*=|分位数|tail|above|below|greater than|less than|between|probability|quantile)/i.test(promptOnly);
  const probabilityNormalReferenceTableRisk = /(正态分布|标准正态|normal distribution|standard normal)/i.test(promptAndExplanation)
    && /(参考|函数值|table|lookup)/i.test(promptAndExplanation)
    && countRegex(promptAndExplanation, /Φ\s*\([^)）]{1,18}[)）]\s*=/gi) >= 3;
  const probabilityConceptOnlyRisk = /概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score/i.test(text)
    && ((probabilityConcreteFrameSignals < 1 && /(关于|说法|概念|要求|条件|特征|which statement|concept|definition)/i.test(promptAndExplanation))
      || /(适合|适用).{0,12}(?:古典概型|概率)|(?:古典概型|概率).{0,12}(?:适合|适用)|直接计算概率/i.test(promptAndExplanation));
  const hasParameterVariable = /(a\s*[,，、]\s*b\s*(?:[∈∊]\s*r|为实数|是实数|in\s*r)|a\s*[∈∊]\s*r|b\s*[∈∊]\s*r)/i.test(promptAndExplanation);
  const hasParameterSolving = /(求出\s*[ab]|求\s*[ab]|[ab]\s*=|判别式|顶点|vertex|discriminant)/i.test(promptAndExplanation);
  const enumeratedConditionCount = countRegex(promptAndExplanation, /[①②③④⑤⑥⑦⑧⑨]|\b[1-9]\s*[.)、]/g);
  const functionPropertyStackCount = countRegex(promptAndExplanation, /(定义域|值域|单调|递增|递减|奇函数|偶函数|奇偶|对称|有界|最值|极值|domain|range|monotonic|increasing|decreasing|parity|odd function|even function|symmetric|bounded|extremum)/gi);
  const functionObjectSignals = countRegex(promptAndExplanation, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi);
  const functionBasicMultiConstraintDomainRisk = /(定义域|domain)/i.test(promptAndExplanation)
    && /(√|sqrt|根式|根号|radical)/i.test(promptAndExplanation)
    && /(1\s*\/|分母|denominator|不能为\s*0|不为\s*0|≠\s*0|!=\s*0)/i.test(promptAndExplanation);
  const orderingSignals = countRegex(text, /(比较|大小|排序|由小到大|由大到小|>|<|log_|sqrt|√|\^|指数|对数|幂)/gi);
  const pureFunctionExternalContextRisk = (propertySignals > 0 || orderingSignals > 0)
    && /(实验|传感器|响应值|输入信号|信号处理|建模|模型输出|建模拟合|拟合|测量|描点法|小组用|sensor|experiment|measurement|signal[- ]?processing|model[- ]?fitting|input signal|model output)/i.test(promptAndExplanation);
  const hardFunctionGenericConceptRisk = /(关于.{0,12}函数性质|函数性质.{0,12}命题|函数性质.{0,12}说法|which statement|which proposition)/i.test(promptOnly)
    && countRegex(promptOnly, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi) < 1;
  const sequenceGenericClassificationRisk = /(下列.{0,12}数列|通项公式.{0,16}(?:表示|是).{0,8}(?:等差|等比)数列|哪个.{0,8}(?:是|表示).{0,8}(?:等差|等比)数列|which sequence|which formula)/i.test(promptOnly)
    && !/(已知|设|a_?\s*\d+|a_\{?\s*n\s*\}?|S_?\s*\d+|S_\{?\s*n\s*\}?|公差\s*[d=]|公比\s*[q=]|求|计算|find|compute)/i.test(promptOnly);
  const elementaryFunctionGenericClassificationRisk = /(初等函数|指数|对数|幂函数|根式|定义域|值域|单调|图像|交点|不等式|elementary function|exponential|logarithm|power function|radical|domain|range|monotonic|graph|intersection|inequality)/i.test(text)
    && /(下列函数中|哪个函数|哪一个函数|which function)/i.test(promptOnly)
    && /(奇函数|偶函数|增函数|减函数|单调|定义域|值域|odd function|even function|increasing|decreasing|monotonic|domain|range)/i.test(promptOnly)
    && !/(已知|设|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|y\s*=|求|计算|比较|交点|不等式|given|find|compute|compare|intersection|inequality)/i.test(promptOnly);
  const vectorComplexBasicDefinitionOnlyRisk = /(向量|复数|vector|complex)/i.test(text)
    && /(定义|概念|以下结论|结论正确|关于.{0,16}(?:复数相等|向量).{0,16}(?:定义|结论)|若复数\s*a\+bi\s*=\s*c\+di|definition|concept|which statement)/i.test(promptAndExplanation)
    && !/[0-9０-９]/.test(promptOnly)
    && !/(求|计算|模长|数量积|点积|夹角|共轭|实部|虚部|平行|垂直|坐标为|z\s*=|find|compute|modulus|dot product|conjugate|real part|imaginary part|parallel|perpendicular)/i.test(promptOnly);
  const analyticGeometryDefinitionOnlyRisk = /(直线|圆|圆锥曲线|椭圆|抛物线|双曲线|方程|line|circle|conic|ellipse|parabola|hyperbola|equation)/i.test(text)
    && /(下列方程|哪个方程|表示.{0,16}(?:椭圆|抛物线|双曲线|圆)|焦点.{0,12}[xy]\s*轴|which equation|represents? an? (?:ellipse|parabola|hyperbola|circle))/i.test(promptOnly)
    && !/(已知|求|计算|距离|斜率|中点|切线|弦|交点|联立|参数|对称|find|compute|distance|slope|midpoint|tangent|chord|intersection|parameter|symmetry)/i.test(promptOnly);
  const analyticGeometryBasicGeneralCircleRisk = /(圆的一般方程|x[²^]\s*\+?\s*y[²^]|x\^2\s*\+\s*y\^2|general equation of (?:a )?circle)/i.test(promptAndExplanation)
    && /(圆心|半径|center|radius)/i.test(promptAndExplanation)
    && /(配方|complete square|completing square|x[²^].{0,40}[+-]\s*\d+\s*x.{0,40}y[²^].{0,40}[+-]\s*\d+\s*y)/i.test(promptAndExplanation);
  const statisticsBasicMultiStatisticComparisonRisk = countRegex(text, /(平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted)/gi) >= 4
    && /(两个|两组|甲班|乙班|甲组|乙组|A组|B组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && /(判断|说法|正确|下列|which statement|correct)/i.test(promptAndExplanation);
  const hardConditionStack = enumeratedConditionCount >= 4
    && /(满足|条件|若|已知[^。？]*满足|given[^.?!]*(?:satisfies|conditions?))/i.test(promptAndExplanation);
  const heavyPropertyStack = functionPropertyStackCount >= 8
    && /(分段|任意|所有|恒成立|参数|讨论|分类讨论|piecewise|for all|parameter|case)/i.test(promptAndExplanation);
  const mediumFunctionPropertyOverComplex = hardConditionStack
    || heavyPropertyStack
    || /(分段|piecewise|当\s*x\s*[<>≤≥=]|x\s*[<>≤≥]\s*0.{0,80}x\s*[<>≤≥]\s*0)/i.test(promptAndExplanation)
    || /(任意|所有|恒成立|对任意|for all|any real|all real)/i.test(promptAndExplanation);
  const derivativeBasicDomainTrapRisk = /(无定义|不存在|不可导|定义域|间断|undefined|does not exist|domain|discontinu)/i.test(promptAndExplanation)
    || /1\s*\/\s*\(\s*x\s*[-−]\s*[0-9]+\s*\).{0,80}x\s*=\s*[0-9]+/i.test(promptAndExplanation);
  const derivativeBasicOverComplexRisk = /导数|微积分|切线|斜率|单调|极值|最值|参数|区间|f'\s*\(|derivative|calculus|tangent|slope|monotonic|extremum|parameter|interval/i.test(text)
    && (mediumFunctionPropertyOverComplex
      || hasExplicitParameterWord
      || (hasParameterVariable && hasParameterSolving)
      || enumeratedConditionCount >= 2
      || /(左右导数|连续性|可导性|连续.*可导|可导.*连续|left[- ]?hand|right[- ]?hand|continuity|differentiability)/i.test(promptAndExplanation));
  const derivativeMediumDefinitionOnlyRisk = /导数|微积分|切线|斜率|f'\s*\(|derivative|calculus|tangent|slope/i.test(text)
    && /(导数的定义|几何意义|可导|以下结论|必然成立|definition of derivative|geometric meaning|differentiable|must be true)/i.test(promptAndExplanation)
    && !/(已知函数|设函数|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|求|计算|切线方程|斜率为|单调区间|极值|最值|参数|区间\s*[\[（(]|given function|find|compute|tangent line|slope is|monotonic interval|extremum|parameter)/i.test(promptOnly);
  const derivativeHardCoefficientSolveOnlyRisk = /导数|微积分|切线|斜率|f'\s*\(|derivative|calculus|tangent|slope/i.test(text)
    && /(求\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}\s*的值|求出\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}|solve for\s*[a-z](?:\s*,\s*[a-z]){1,3})/i.test(promptAndExplanation)
    && /(经过点|切线斜率|斜率分别|passes through|tangent slopes?)/i.test(promptAndExplanation)
    && !/(单调|递增|递减|极值|最值|恒成立|取值范围|参数范围|不等式|区间.{0,20}(?:成立|单调|递增|递减)|sign chart|monotonic|extremum|range of|for all|inequality)/i.test(promptAndExplanation);
  const vectorComplexCoordinateGeometryDriftRisk = /(点\s*[A-ZＰＱP-Q]|直线\s*[a-zl]|点到直线|过\s*[A-Z].{0,8}[A-Z]|投影点|projection point|point-to-line|line through)/i.test(promptAndExplanation)
    && (/(距离|斜率|交点|垂足|直线方程|distance|slope|intersection|foot of perpendicular|line equation)/i.test(promptAndExplanation)
      || /(方向向量|点\s*[A-ZＰＱP-Q].{0,24}在\s*(?:直线\s*)?[a-zl]|p\s*q\s*[·.]\s*d\s*=\s*0|projection|direction vector)/i.test(promptAndExplanation));
  const vectorComplexHardDirectMetricRisk = /(向量|复数|坐标|数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|vector|complex|coordinate|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|\|[^|\n]{0,40}\|)/i.test(text)
    && /(等于多少|求|计算|find|compute|equals?)/i.test(promptAndExplanation)
    && /(数量积|点积|模长|模|长度|dot product|modulus|norm|length|\|[^|\n]{0,40}\|)/i.test(promptAndExplanation)
    && !/(轨迹|交点|参数|取值范围|辐角|幅角|平行|垂直|argument|locus|intersection|parameter|range of|parallel|perpendicular)/i.test(promptAndExplanation);
  const analyticGeometryHardConicRelationOnlyRisk = /(直线|圆|圆锥曲线|椭圆|抛物线|双曲线|方程|line|circle|conic|ellipse|parabola|hyperbola|equation)/i.test(text)
    && /(相同的焦点|共享焦点|离心率|∠|夹角|same foc(?:us|i)|eccentricit)/i.test(promptAndExplanation)
    && /(e_?1|e1|e_?2|e2|离心率)/i.test(promptAndExplanation)
    && !/(参数|取值范围|范围|切线|弦长|面积|最值|最大|最小|定点|轨迹|parameter|range|max|min|tangent|chord|area|locus)/i.test(promptAndExplanation);
  const statisticsHardDirectCombinedVarianceRisk = /平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted/i.test(text)
    && /(甲组|乙组|两个|两组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(合并后.{0,12}方差|合并.{0,20}方差|combined variance|pooled variance)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|最大|最小|取值范围|使得|至少|至多|missing|unknown|adjust|remove|add|range|min|max|at least|at most)/i.test(promptAndExplanation);
  const statisticsMediumPureLinearTransformRisk = /平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted/i.test(text)
    && /(线性变换|每个数据|每个数|y[_ᵢi]?\s*=|y_i\s*=|yᵢ\s*=|linear transform|each data)/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|替换|比较|两组|两个|甲组|乙组|取值范围|参数|使得|missing|unknown|adjust|remove|add|replace|compare|two groups|parameter|range)/i.test(promptAndExplanation);
  const spatialHardConceptOnlyRisk = /空间|立体|平面|线面|面面|长方体|棱锥|棱柱|法向量|二面角|体积|投影|垂直|平行|夹角|space|spatial|solid geometry|plane|line-plane|normal vector|dihedral|volume|projection|perpendicular|parallel|angle/i.test(text)
    && (/(下列关于空间几何位置关系|关于.{0,24}空间.{0,24}位置关系|说法正确|命题中|position relations?)/i.test(promptAndExplanation)
      || /(对称关系|对称变换|symmetry relation|symmetric transformation)/i.test(promptAndExplanation))
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptAndExplanation);
  const spatialMediumMultiPropositionOvercomplexRisk = /空间|立体|平面|线面|面面|长方体|棱锥|棱柱|法向量|二面角|体积|投影|垂直|平行|夹角|space|spatial|solid geometry|plane|line-plane|normal vector|dihedral|volume|projection|perpendicular|parallel|angle/i.test(text)
    && /(四面体|长方体|棱锥|棱柱|顶点坐标分别|tetrahedron|cuboid|pyramid|prism|vertices)/i.test(promptAndExplanation)
    && /(四个命题|命题中|下列关于|说法正确|which statement)/i.test(promptAndExplanation)
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptOnly);
  return {
    propertySignals,
    statementMarkers: countRegex(text, /[①②③④⑤⑥]|\b[1-6][\).、]/g),
    transformationSignals,
    orderingSignals,
    probabilitySignals: countRegex(text, /(概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score)/gi),
    probabilityEventLabelCount,
    probabilityNormalHardInteractionCueCount,
    probabilityHardInteractionCueCount,
    probabilityConcreteFrameSignals,
    probabilityNormalMediumNoEventRisk,
    probabilityNormalReferenceTableRisk,
    probabilityConceptOnlyRisk,
    probabilitySingleResultRisk,
    probabilityEventListOnlyRisk,
    derivativeSignals: countRegex(text, /(导数|微积分|切线|斜率|单调|极值|最值|参数|区间|f'\s*\(|derivative|calculus|tangent|slope|monotonic|extremum|parameter|interval)/gi),
    vectorComplexSignals: countRegex(text, /(向量|复数|坐标|数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|投影|轨迹|vector|complex|coordinate|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|projection|locus|\|[^|\n]{0,40}(?:z|向量|\\vec|overline)[^|\n]{0,40}\||\\overline|\\operatorname\{Re\}|Re\s*\()/gi),
    vectorComplexBasicDefinitionOnlyRisk,
    geometrySignals: countRegex(text, /(直线|圆|圆锥曲线|椭圆|抛物线|双曲线|斜率|距离|中点|切线|弦|交点|方程|参数|对称|line|circle|conic|ellipse|parabola|hyperbola|slope|distance|midpoint|tangent|chord|intersection|equation|parameter|symmetry)/gi),
    analyticGeometryDefinitionOnlyRisk,
    analyticGeometryBasicGeneralCircleRisk,
    elementaryFunctionSignals: countRegex(text, /(初等函数|指数|对数|幂函数|根式|定义域|值域|单调|图像|交点|不等式|elementary function|exponential|logarithm|power function|radical|domain|range|monotonic|graph|intersection|inequality)/gi),
    elementaryFunctionGenericClassificationRisk,
    sequenceSignals: countRegex(text, /(数列|等差|等比|通项|递推|前\s*n\s*项和|公差|公比|单调|求和|sequence|arithmetic sequence|geometric sequence|recurrence|common difference|common ratio|partial sum)/gi),
    sequenceGenericClassificationRisk,
    statisticsSignals: countRegex(text, /(平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted)/gi),
    statisticsBasicMultiStatisticComparisonRisk,
    spatialSignals: countRegex(text, /(空间|立体|平面|线面|面面|长方体|棱锥|棱柱|法向量|二面角|体积|投影|垂直|平行|夹角|space|spatial|solid geometry|plane|line-plane|normal vector|dihedral|volume|projection|perpendicular|parallel|angle)/gi),
    vectorComplexCoordinateGeometryDriftRisk,
    vectorComplexHardDirectMetricRisk,
    parameterInferenceRisk: hasExplicitParameterWord || (hasParameterVariable && hasParameterSolving),
    derivativeBasicDomainTrapRisk,
    derivativeBasicOverComplexRisk,
    derivativeMediumDefinitionOnlyRisk,
    derivativeHardCoefficientSolveOnlyRisk,
    optionJudgement: /(下列|判断|正确|错误|选项|（\s*）|\(\s*\)|which|statement)/i.test(text),
    enumeratedConditionCount,
    functionPropertyStackCount,
    functionObjectSignals,
    functionBasicMultiConstraintDomainRisk,
    pureFunctionExternalContextRisk,
    hardFunctionGenericConceptRisk,
    mediumFunctionPropertyOverComplex,
    analyticGeometryHardConicRelationOnlyRisk,
    statisticsHardDirectCombinedVarianceRisk,
    statisticsMediumPureLinearTransformRisk,
    spatialHardConceptOnlyRisk,
    spatialMediumMultiPropositionOvercomplexRisk
  };
}

function mathCalibrationFamily(row) {
  const centralFamily = subjectPracticeClassifyTaskFamily({
    subject: 'math',
    topicTitle: row.topicTitle,
    prompt: row.prompt,
    options: row.options,
    explanation: row.explanation
  });
  return cleanText(centralFamily || row.family);
}

function calibrationTarget(row, subject = 'chemistry', features = null) {
  const normalizedSubject = String(subject || '').trim().toLowerCase();
  const cellId = String(row.cellId || '').trim();
  const topicTitle = String(row.topicTitle || '').trim().toLowerCase();
  const difficulty = String(row.difficulty || '').trim().toLowerCase();
  if (normalizedSubject === 'math') {
    const family = mathCalibrationFamily(row);
    const functionTopic = /函数|function|logarithm|exponential|quadratic/.test(topicTitle);
    const elementaryTopic = /基本初等函数|初等函数|elementary function/.test(topicTitle);
    const derivativeTopic = /导数|微积分|derivative|calculus/.test(topicTitle);
    const knownMathFunctionFamily = [
      'function_monotonicity_parity_statement',
      'elementary_function_exp_log_ordering',
      'logarithmic_equation_domain_solution',
      'quadratic_function_properties',
      'function_quadratic_parameter_property'
    ].includes(family);
    if (['352', '351'].includes(cellId) || (!elementaryTopic && /函数|function/.test(topicTitle) && ['basic', 'hard'].includes(difficulty))) {
      return {
        seedCellId: difficulty === 'hard' ? '351' : '352',
        taskFamily: difficulty === 'hard' ? 'hard_function_multi_condition_property' : 'basic_function_direct_property',
        planTemplate: 'math_function_property_by_difficulty_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (['355', '354', '353'].includes(cellId) || elementaryTopic) {
      return {
        seedCellId: difficulty === 'basic' ? '355' : difficulty === 'hard' ? '354' : '353',
        taskFamily: difficulty === 'hard' ? 'hard_elementary_function_parameter_or_inequality' : difficulty === 'basic' ? 'elementary_function_direct_property' : 'elementary_function_exp_log_ordering',
        planTemplate: 'math_elementary_function_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (cellId === '350' || (!derivativeTopic && ((functionTopic && difficulty === 'medium') || knownMathFunctionFamily))) {
      if (features?.parameterInferenceRisk || family === 'function_quadratic_parameter_property') {
        return {
          seedCellId: '350',
          taskFamily: 'function_quadratic_parameter_property',
          planTemplate: 'math_medium_function_parameter_constraint_v1'
        };
      }
      if (['elementary_function_exp_log_ordering', 'logarithmic_equation_domain_solution'].includes(family)) {
        return {
          seedCellId: '350',
          taskFamily: 'elementary_function_exp_log_ordering',
          planTemplate: 'math_medium_exp_log_ordering_chain_v1'
        };
      }
      return {
        seedCellId: '350',
        taskFamily: family || 'medium_function_property_combination',
        planTemplate: 'math_medium_function_two_move_reasoning_v1'
      };
    }
    if (/概率|排列组合|正态分布|probability|combinatorics|normal distribution/.test(topicTitle) || ['probability_multi_event_counting', 'normal_distribution_z_score_probability'].includes(family)) {
      const normalDistributionTarget = /正态分布|normal distribution|standard normal|z[-_ ]?score/.test(topicTitle)
        || family === 'normal_distribution_z_score_probability';
      return {
        seedCellId: normalDistributionTarget
          ? difficulty === 'basic' ? '367' : difficulty === 'hard' ? '366' : '365'
          : difficulty === 'basic' ? '361' : difficulty === 'hard' ? '360' : '359',
        taskFamily: normalDistributionTarget ? 'normal_distribution_z_score_probability' : 'probability_multi_event_counting',
        planTemplate: 'math_probability_counting_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (/向量|复数|vector|complex/.test(topicTitle) || ['vector_coordinate_norm_dot_angle', 'complex_mod_vector_dot_product', 'complex_conjugate_linear_equation_solve'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '340' : difficulty === 'hard' ? '339' : '338',
        taskFamily: 'vector_coordinate_norm_dot_angle',
        planTemplate: 'math_vector_complex_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (/导数|微积分|derivative|calculus/.test(topicTitle) || ['derivative_direct_evaluation', 'derivative_tangent_constraint'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '349' : difficulty === 'hard' ? '348' : '347',
        taskFamily: difficulty === 'basic' ? 'derivative_direct_evaluation' : 'derivative_tangent_constraint',
        planTemplate: 'math_derivative_condition_chain_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (/平面解析几何|解析几何|圆锥曲线|直线|圆|analytic geometry|conic|circle|line/.test(topicTitle) || ['circle_line_chord_length', 'conic_shared_focus_relation'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '343' : difficulty === 'hard' ? '342' : '341',
        taskFamily: 'circle_line_chord_length',
        planTemplate: 'math_analytic_geometry_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (['358', '357', '356'].includes(cellId) || /数列|sequence|等差|等比|递推/.test(topicTitle) || ['arithmetic_sequence_two_condition_solve_a1_d', 'geometric_sequence_two_condition_solve_q'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '358' : difficulty === 'hard' ? '357' : '356',
        taskFamily: difficulty === 'hard' ? 'hard_sequence_multi_constraint_reasoning' : 'arithmetic_sequence_two_condition_solve_a1_d',
        planTemplate: 'math_sequence_condition_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (['364', '363', '362'].includes(cellId) || /数据|统计|数字特征|平均数|方差|statistics|data|mean|variance/.test(topicTitle) || ['combined_variance', 'mean_removed_value', 'direct_variance_formula'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '364' : difficulty === 'hard' ? '363' : '362',
        taskFamily: difficulty === 'hard' ? 'hard_statistics_multi_step_inference' : difficulty === 'basic' ? 'direct_variance_formula' : 'combined_variance',
        planTemplate: 'math_statistics_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    if (['346', '345', '344'].includes(cellId) || /空间几何|立体几何|空间|spatial geometry|solid geometry/.test(topicTitle) || ['spatial_coordinate_direct_metric', 'coordinate_geometry_point_to_plane_distance', 'spatial_line_plane_concept_judgement', 'spatial_vector_angle_cosine'].includes(family)) {
      return {
        seedCellId: difficulty === 'basic' ? '346' : difficulty === 'hard' ? '345' : '344',
        taskFamily: difficulty === 'hard' ? 'hard_spatial_multi_constraint_vector_reasoning' : difficulty === 'basic' ? 'spatial_coordinate_direct_metric' : 'medium_geometry_coordinate_vector_reasoning',
        planTemplate: 'math_spatial_geometry_relation_v1',
        targetDifficulty: difficulty || null
      };
    }
    return null;
  }
  if (cellId === '41' || ((topicTitle.includes('ph') || topicTitle.includes('酸碱') || topicTitle.includes('溶液浓度')) && difficulty === 'basic')) {
    return { seedCellId: '41', taskFamily: 'basic_ph_measurement_or_preparation_error_judgement', planTemplate: 'basic_ph_measurement_preparation_error_v1', productionTemplate: true };
  }
  if (cellId === '592' || ((topicTitle.includes('lab') || topicTitle.includes('experiment') || topicTitle.includes('实验') || topicTitle.includes('仪器')) && difficulty === 'medium')) {
    return { seedCellId: '592', taskFamily: 'medium_lab_two_operation_evidence', planTemplate: 'two_linked_operations_causal_propagation_v1' };
  }
  if (cellId === '593' || ((topicTitle.includes('lab') || topicTitle.includes('experiment') || topicTitle.includes('实验') || topicTitle.includes('仪器')) && difficulty === 'hard')) {
    return { seedCellId: '593', taskFamily: 'hard_experimental_evidence_chain', planTemplate: 'competing_hypothesis_discrimination_v1' };
  }
  if (cellId === '596' || ((topicTitle.includes('organic') || topicTitle.includes('有机')) && difficulty === 'hard')) {
    return { seedCellId: '596', taskFamily: 'hard_organic_combustion_reaction_evidence_calculation', planTemplate: 'organic_formula_reaction_unique_structure_v1' };
  }
  if (cellId === '607' || ((topicTitle.includes('gas') || topicTitle.includes('气体')) && difficulty === 'hard')) {
    return { seedCellId: '607', taskFamily: 'hard_gas_impurity_elimination', planTemplate: 'gas_impurity_control_competing_elimination_v1', productionTemplate: true };
  }
  if (cellId === '608' || ((topicTitle.includes('gas') || topicTitle.includes('气体')) && difficulty === 'basic')) {
    return { seedCellId: '608', taskFamily: 'basic_gas_collection_test_rule', planTemplate: 'basic_gas_collection_test_calibration_v1', productionTemplate: false };
  }
  if (cellId === '610' || ((topicTitle.includes('redox') || topicTitle.includes('氧化还原')) && difficulty === 'hard')) {
    return { seedCellId: '610', taskFamily: 'hard_redox_electron_transfer_quantitative_chain', planTemplate: 'redox_electron_transfer_quantitative_chain_v1', productionTemplate: true };
  }
  if (cellId === '611' || ((topicTitle.includes('redox') || topicTitle.includes('氧化还原')) && difficulty === 'basic')) {
    return { seedCellId: '611', taskFamily: 'basic_redox_single_species_judgement', planTemplate: 'basic_redox_single_reaction_valence_rule_v1', productionTemplate: true };
  }
  return null;
}

function calibrationVerdict(target, features, subject = 'chemistry') {
  if (String(subject || '').trim().toLowerCase() === 'math') {
    if (target?.seedCellId === '350') {
      if (features.pureFunctionExternalContextRisk) return 'needs_pure_function_external_context_repair';
      if (target.planTemplate === 'math_medium_function_parameter_constraint_v1' && features.parameterInferenceRisk) return 'candidate_matches_parameter_constraint_plan_shape';
      if (features.mediumFunctionPropertyOverComplex) return 'needs_medium_function_complexity_calibration';
      if (features.propertySignals >= 3 && (features.statementMarkers >= 1 || features.transformationSignals >= 1) && features.optionJudgement) return 'candidate_matches_function_property_plan_shape';
      if (features.orderingSignals >= 3 && features.transformationSignals >= 1) return 'candidate_matches_exp_log_ordering_plan_shape';
      return 'needs_plan_evidence_slot_calibration';
    }
    if (target?.planTemplate === 'math_probability_counting_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 5 : 4;
      const effectiveProbabilitySignals = features.probabilitySignals + Math.min(features.probabilityNormalHardInteractionCueCount || 0, 3);
      if (difficulty === 'basic' && features.probabilityConceptOnlyRisk) return 'needs_basic_probability_concept_only_repair';
      if (difficulty === 'medium' && features.probabilitySingleResultRisk) return 'needs_probability_single_result_repair';
      if (difficulty === 'medium' && features.probabilityNormalMediumNoEventRisk) return 'needs_medium_normal_probability_no_event_repair';
      if (difficulty === 'hard' && features.probabilityEventListOnlyRisk) return 'needs_hard_probability_event_list_repair';
      if (difficulty === 'hard' && features.probabilityNormalReferenceTableRisk) return 'needs_hard_normal_reference_table_repair';
      if (difficulty === 'hard' && features.probabilityHardInteractionCueCount < 1) return 'needs_hard_probability_interaction_repair';
      return effectiveProbabilitySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1 || features.probabilityNormalHardInteractionCueCount >= 2)
        ? 'candidate_matches_probability_counting_plan_shape'
        : 'needs_probability_event_relation_calibration';
    }
    if (target?.planTemplate === 'math_vector_complex_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'basic' && features.vectorComplexBasicDefinitionOnlyRisk) return 'needs_basic_vector_complex_definition_only_repair';
      if (difficulty === 'medium' && features.vectorComplexCoordinateGeometryDriftRisk) return 'needs_vector_complex_coordinate_geometry_drift_repair';
      if (difficulty === 'hard' && features.vectorComplexHardDirectMetricRisk) return 'needs_hard_vector_complex_direct_metric_repair';
      return features.vectorComplexSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_vector_complex_relation_plan_shape'
        : 'needs_vector_complex_relation_calibration';
    }
    if (target?.planTemplate === 'math_derivative_condition_chain_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'basic' && features.derivativeBasicOverComplexRisk) return 'needs_basic_derivative_complexity_repair';
      if (difficulty === 'basic' && features.derivativeBasicDomainTrapRisk) return 'needs_basic_derivative_domain_trap_repair';
      if (difficulty === 'medium' && features.derivativeMediumDefinitionOnlyRisk) return 'needs_medium_derivative_definition_only_repair';
      if (difficulty === 'hard' && features.derivativeHardCoefficientSolveOnlyRisk) return 'needs_hard_derivative_coefficient_solve_only_repair';
      return features.derivativeSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_derivative_condition_plan_shape'
        : 'needs_derivative_condition_calibration';
    }
    if (target?.planTemplate === 'math_analytic_geometry_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'basic' && features.analyticGeometryBasicGeneralCircleRisk) return 'needs_basic_analytic_geometry_general_circle_repair';
      if (difficulty !== 'basic' && features.analyticGeometryDefinitionOnlyRisk) return 'needs_medium_analytic_geometry_definition_only_repair';
      if (difficulty === 'hard' && features.analyticGeometryHardConicRelationOnlyRisk) return 'needs_hard_analytic_geometry_conic_relation_only_repair';
      return features.geometrySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_analytic_geometry_relation_plan_shape'
        : 'needs_analytic_geometry_relation_calibration';
    }
    if (target?.planTemplate === 'math_function_property_by_difficulty_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : 4;
      if (difficulty === 'basic' && features.functionBasicMultiConstraintDomainRisk) return 'needs_basic_function_multi_constraint_domain_repair';
      if (difficulty === 'hard' && features.hardFunctionGenericConceptRisk) return 'needs_hard_function_generic_concept_repair';
      return features.propertySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_function_property_by_difficulty_plan_shape'
        : 'needs_function_property_by_difficulty_calibration';
    }
    if (target?.planTemplate === 'math_elementary_function_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'medium' && features.elementaryFunctionGenericClassificationRisk) return 'needs_medium_elementary_function_generic_classification_repair';
      return features.elementaryFunctionSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_elementary_function_relation_plan_shape'
        : 'needs_elementary_function_relation_calibration';
    }
    if (target?.planTemplate === 'math_sequence_condition_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'basic' && features.sequenceGenericClassificationRisk) return 'needs_basic_sequence_generic_classification_repair';
      return features.sequenceSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_sequence_condition_relation_plan_shape'
        : 'needs_sequence_condition_relation_calibration';
    }
    if (target?.planTemplate === 'math_statistics_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'basic' && features.statisticsBasicMultiStatisticComparisonRisk) return 'needs_basic_statistics_multi_statistic_comparison_repair';
      if (difficulty === 'medium' && features.statisticsMediumPureLinearTransformRisk) return 'needs_medium_statistics_pure_linear_transform_repair';
      if (difficulty === 'hard' && features.statisticsHardDirectCombinedVarianceRisk) return 'needs_hard_statistics_direct_combined_variance_repair';
      return features.statisticsSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_statistics_relation_plan_shape'
        : 'needs_statistics_relation_calibration';
    }
    if (target?.planTemplate === 'math_spatial_geometry_relation_v1') {
      const difficulty = cleanText(target.targetDifficulty);
      const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
      if (difficulty === 'medium' && features.spatialMediumMultiPropositionOvercomplexRisk) return 'needs_medium_spatial_multi_proposition_overcomplex_repair';
      if (difficulty === 'hard' && features.spatialHardConceptOnlyRisk) return 'needs_hard_spatial_concept_only_repair';
      return features.spatialSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
        ? 'candidate_matches_spatial_geometry_relation_plan_shape'
        : 'needs_spatial_geometry_relation_calibration';
    }
    return 'unknown_math_cell';
  }
  if (target?.seedCellId === '41') {
    return features.phConceptMarkers >= 2 && features.phOperationErrorMarkers >= 2 && features.phDirectionMarkers >= 2
      ? 'candidate_matches_basic_ph_measurement_error_plan_shape'
      : 'needs_basic_ph_measurement_error_plan_calibration';
  }
  if (target?.seedCellId === '592') {
    return (features.operationWords >= 4 && features.reasoningConnectors >= 2 && features.hypothesisMarkers >= 1)
      ? 'maybe_two_operation_plan'
      : 'likely_single_rule_or_single_operation';
  }
  if (target?.seedCellId === '593') {
    return (features.observationWords >= 4 && features.hypothesisMarkers >= 2 && features.reasoningConnectors >= 3)
      ? 'maybe_competing_evidence_chain'
      : 'likely_insufficient_hard_evidence_chain';
  }
  if (target?.seedCellId === '596') {
    return (features.quantitativeMarkers >= 5 && features.reactionClues >= 3 && features.reasoningConnectors >= 4)
      ? 'maybe_hard_organic_plan'
      : 'likely_insufficient_independent_clues_or_quant_shape';
  }
  if (target?.seedCellId === '607') {
    return (features.gasSpeciesMarkers >= 2 && features.gasControlMarkers >= 3)
      ? 'maybe_hard_gas_impurity_control_plan'
      : 'likely_direct_gas_property_or_single_control_rule';
  }
  if (target?.seedCellId === '608') {
    return (features.gasSpeciesMarkers >= 1 && features.gasControlMarkers >= 1)
      ? 'candidate_matches_basic_gas_collection_or_test_rule'
      : 'needs_basic_gas_rule_calibration';
  }
  if (target?.seedCellId === '610') {
    if (features.redoxReactionMarkers >= 2 && features.redoxConceptMarkers >= 3 && features.quantitativeMarkers >= 1 && features.reasoningConnectors >= 2) {
      return 'maybe_hard_redox_electron_balance_plan';
    }
    if (features.redoxReactionMarkers >= 2 && features.quantitativeMarkers >= 3 && features.redoxQuantitativeChainMarkers >= 2 && features.reasoningConnectors >= 1) {
      return 'maybe_hard_redox_quant_chain_but_profile_mismatch';
    }
    return 'likely_direct_valence_judgement_missing_quant_chain';
  }
  if (target?.seedCellId === '611') {
    return (features.redoxReactionMarkers >= 1 && features.redoxConceptMarkers >= 2)
      ? 'candidate_matches_basic_redox_valence_rule'
      : 'needs_basic_redox_rule_calibration';
  }
  return 'unknown_cell';
}

function summarize(evaluated) {
  const summary = {};
  for (const item of evaluated) {
    if (!summary[item.cellId]) summary[item.cellId] = {
      total: 0,
      verdicts: {},
      gateReasons: {},
      questionPlanAdheresCount: 0,
      questionPlanFailureCodes: {}
    };
    summary[item.cellId].total += 1;
    summary[item.cellId].verdicts[item.verdict] = (summary[item.cellId].verdicts[item.verdict] || 0) + 1;
    if (item.questionPlanAdherence?.adheres === true) summary[item.cellId].questionPlanAdheresCount += 1;
    for (const code of arrayFrom(item.questionPlanAdherence?.failureCodes)) {
      summary[item.cellId].questionPlanFailureCodes[code] = (summary[item.cellId].questionPlanFailureCodes[code] || 0) + 1;
    }
    for (const reason of item.gateReasons || []) {
      const displayReason = qualityAuditDisplayReason(reason);
      summary[item.cellId].gateReasons[displayReason] = (summary[item.cellId].gateReasons[displayReason] || 0) + 1;
    }
  }
  return summary;
}

function assertCalibrationSelfTest(condition, message) {
  if (!condition) throw new Error(`question-plan calibration self-test failed: ${message}`);
}

function runMathCalibrationSelfTest() {
  const rows = [
    {
      id: 16233,
      cellId: '350',
      status: 'pending_review',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '已知函数 f(x)=x/(x^2+1)，给出如下四个判断：① 定义域为 R；② 图象关于原点对称；③ 在 [0,1] 上单调递增；④ 值域为 [-1/2,1/2]。下列选项正确的是（ ）',
      explanation: '定义域为 R，且 f(-x)=-f(x)，所以为奇函数。由导数判断单调性；值域可由 y=x/(x^2+1) 转化为二次方程并由判别式得到。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 16211,
      cellId: '350',
      status: 'pending_review',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '某探究小组记录三个函数 f(x)=log_2 x, g(x)=2^x, h(x)=x^{1/2}（即√x）在指定点的取值：a=f(3), b=g(0.6), c=h(2.5)。现要比较 a,b,c 的大小，下列判断正确的是（ ）',
      explanation: '需要分别估计对数、指数与根式的大小，再比较 a,b,c 的顺序。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 16338,
      cellId: '350',
      status: 'approved',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '为比较指数、对数与幂函数值的大小，设 a=log_2 3，b=2^(1/2)，c=log_3 4；且 2^(3/2)=2√2<3，3^(4/3)=3∛3>4，4/3<√2。下列排序正确的是？',
      explanation: '由 2^(3/2)<3 得 log_2 3>3/2；由 3^(4/3)>4 得 log_3 4<4/3。又 4/3<√2<3/2，所以 a>3/2>√2>4/3>c，即 a>b>c。',
      gateReasons: [],
      profileReasons: []
    },
    {
      id: 15527,
      cellId: '350',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '设 g(x)=x^2-ax+b，f(x)=log_2 g(x)，其中 a,b∈R。已知 f 满足：①定义域为 R；②值域为 [0,+∞)；③图象关于直线 x=1 对称；④g(x) 的最小值为 m。下列判断正确的是（ ）',
      explanation: '由 g(x)=(x-a/2)^2+b-a^2/4 的顶点与判别式条件求 a,b,m，再判断 f 的单调性与最值。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 15938,
      cellId: '350',
      status: 'pending_review',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '设函数值 a=log₂3，b=log₃5，c=log₄8，d=log₅25，且四个值互不相等。下列大小关系正确的是（ ）',
      explanation: '结合对数换底和估算区间比较四个值的大小。',
      gateReasons: ['reviewer_human_review'],
      profileReasons: []
    },
    {
      id: 16487,
      cellId: '350',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '已知函数 f 定义在 R 上，满足：① 当 x≥0 时，f(x)=x/(1+x)；② 当 x<0 时，f(x)=x/(1−x)；③ f(1)=1/2；④ f(−1)=−1/2；⑤ 对任意 x∈R，都有 |f(x)|<1。则下列判断正确的是？',
      explanation: '分别代入正负区间可得 f(-x)=-f(x)，所以答案为 A。',
      gateReasons: ['profile_difficulty_evidence_mismatch', 'review_failed'],
      profileReasons: ['calculation_load_band_mismatch']
    },
    {
      id: 10687,
      cellId: '352',
      status: 'archived',
      difficulty: 'basic',
      topicTitle: '函数的概念与性质',
      prompt: '函数 f(x)=√(x-1)+1/(x-2) 的定义域是（ ）',
      explanation: '根式要求 x-1≥0，分母要求 x-2≠0，因此定义域为 [1,2)∪(2,+∞)。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 17001,
      cellId: '359',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '古典概型与概率计算',
      prompt: '从含 3 个红球、2 个白球的袋中不放回抽取 2 个，设事件 A 为恰好一个红球，事件 B 为至少一个白球。下列概率关系正确的是（ ）',
      explanation: '先确定样本空间，再分别计数事件 A、B 及交集，由条件和互斥关系比较概率。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 17002,
      cellId: '338',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '向量与复数',
      prompt: '已知向量 a=(1,2), b=(t,-1)，且 a 与 b 垂直。求参数 t 后判断 |a+b| 的取值正确的是（ ）',
      explanation: '由数量积为 0 得参数 t，再代入坐标计算向量 a+b 的模长，因此排除错误选项。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 17005,
      cellId: '339',
      status: 'archived',
      difficulty: 'hard',
      topicTitle: '向量与复数',
      prompt: '设复数 $z_1$ 和 $z_2$ 满足 $|z_1|=2$，$|z_2|=3$，$|z_1+z_2|=4$，则向量 $z_1$ 与 $z_2$ 的数量积（即 $\\operatorname{Re}(z_1\\overline{z_2})$）等于多少？',
      explanation: '由 |z_1+z_2|^2=|z_1|^2+|z_2|^2+2\\operatorname{Re}(z_1\\overline{z_2})，可得数量积并检查唯一选项。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: ['difficulty_complexity_mismatch']
    },
    {
      id: 17003,
      cellId: '347',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '导数与微积分初步',
      prompt: '已知 f(x)=x^3-3x+a，若曲线在 x=1 处切线斜率为 0，并要求 f(x) 在区间 [-1,1] 的单调性判断正确。下列选项正确的是（ ）',
      explanation: '先求导数 f\'(x)，用切线斜率条件确定关系，再结合导数符号判断区间单调性。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 17004,
      cellId: '341',
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '平面解析几何',
      prompt: '已知直线 l: y=kx+1 与圆 x^2+y^2=5 相交成弦 AB，若圆心到直线的距离为 1，判断弦长 AB 的取值正确的是（ ）',
      explanation: '由直线方程求圆心到直线距离，再结合半径与弦心距关系计算弦长，因此只有一个选项满足。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 17006,
      cellId: '363',
      status: 'archived',
      difficulty: 'hard',
      topicTitle: '数据的数字特征',
      prompt: '已知甲组有5个数据，平均值为8，方差为2；乙组有7个数据，平均值为6，方差为3。现将两组数据合并成一组，则合并后数据的方差是？',
      explanation: '先合并两组样本均值，再把组内方差与两组均值差造成的组间平方偏差加权合并，最后得到总体方差。',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: ['difficulty_complexity_mismatch']
    }
  ];
  const evaluated = rows.map((row) => {
    const features = mathCandidateFeatures(row);
    const family = mathCalibrationFamily(row);
    const target = calibrationTarget(row, 'math', features);
    return {
      id: Number(row.id),
      cellId: row.cellId,
      seedCellId: target?.seedCellId || null,
      taskFamily: target?.taskFamily || null,
      planTemplate: target?.planTemplate || null,
      status: row.status,
      difficulty: row.difficulty,
      topicTitle: row.topicTitle || null,
      family: family || null,
      verdict: calibrationVerdict(target, features, 'math'),
      features,
      gateReasons: (row.gateReasons || []).map(qualityAuditDisplayReason),
      profileReasons: row.profileReasons || [],
      promptPreview: String(row.prompt || '').slice(0, 180)
    };
  });
  const summary = summarize(evaluated);
  const byId = new Map(evaluated.map((item) => [item.id, item]));
  assertCalibrationSelfTest(byId.get(16233)?.verdict === 'candidate_matches_function_property_plan_shape', '#16233 must remain function-property plan shape');
  assertCalibrationSelfTest(byId.get(16233)?.features?.parameterInferenceRisk === false, '#16233 discriminant range evidence must not become parameter inference');
  assertCalibrationSelfTest(byId.get(16211)?.family === 'elementary_function_exp_log_ordering', '#16211 mixed exp/log/power ordering must use central ordering family');
  assertCalibrationSelfTest(byId.get(16211)?.verdict === 'candidate_matches_exp_log_ordering_plan_shape', '#16211 must match exp/log ordering plan shape');
  assertCalibrationSelfTest(byId.get(16338)?.family === 'elementary_function_exp_log_ordering', '#16338 Pro publishable sample must use central ordering family');
  assertCalibrationSelfTest(byId.get(16338)?.verdict === 'candidate_matches_exp_log_ordering_plan_shape', '#16338 Pro publishable sample must match exp/log ordering plan shape');
  assertCalibrationSelfTest(byId.get(15527)?.planTemplate === 'math_medium_function_parameter_constraint_v1', '#15527-style parameter inference must use the parameter-constraint plan');
  assertCalibrationSelfTest(byId.get(15527)?.verdict === 'candidate_matches_parameter_constraint_plan_shape', '#15527-style parameter inference must match the parameter-constraint plan shape');
  assertCalibrationSelfTest(byId.get(15938)?.gateReasons?.includes('reviewer_needs_quality_attention'), 'legacy reviewer_human_review must display as quality attention');
  assertCalibrationSelfTest(byId.get(16487)?.features?.mediumFunctionPropertyOverComplex === true, '#16487-style function-property condition stacks must expose over-complexity evidence');
  assertCalibrationSelfTest(byId.get(16487)?.verdict === 'needs_medium_function_complexity_calibration', '#16487-style function-property condition stacks must not be counted as clean medium function-property plan matches');
  assertCalibrationSelfTest(byId.get(10687)?.features?.functionBasicMultiConstraintDomainRisk === true, 'Basic function-domain calibration must expose radical plus denominator multi-constraint risk.');
  assertCalibrationSelfTest(byId.get(10687)?.verdict === 'needs_basic_function_multi_constraint_domain_repair', 'Basic function-domain rows with radical plus denominator constraints must require repair.');
  assertCalibrationSelfTest(byId.get(17001)?.planTemplate === 'math_probability_counting_relation_v1', 'Probability rows must map to the probability counting relation plan');
  assertCalibrationSelfTest(byId.get(17001)?.verdict === 'candidate_matches_probability_counting_plan_shape', 'Probability rows must match event/counting plan shape');
  assertCalibrationSelfTest(byId.get(17002)?.planTemplate === 'math_vector_complex_relation_v1', 'Vector/complex rows must map to the vector-complex relation plan');
  assertCalibrationSelfTest(byId.get(17002)?.verdict === 'candidate_matches_vector_complex_relation_plan_shape', 'Vector/complex rows must match relation plan shape');
  assertCalibrationSelfTest(byId.get(17005)?.features?.vectorComplexSignals >= 4, 'Vector/complex calibration must count modulus, conjugate, and real-part notation as evidence.');
  assertCalibrationSelfTest(byId.get(17005)?.features?.vectorComplexHardDirectMetricRisk === true, 'Hard vector/complex direct metric rows must expose direct metric risk.');
  assertCalibrationSelfTest(byId.get(17005)?.verdict === 'needs_hard_vector_complex_direct_metric_repair', 'Hard vector/complex modulus round-trip rows must require direct metric repair.');
  assertCalibrationSelfTest(byId.get(17003)?.planTemplate === 'math_derivative_condition_chain_v1', 'Derivative rows must map to the derivative condition plan');
  assertCalibrationSelfTest(byId.get(17003)?.verdict === 'candidate_matches_derivative_condition_plan_shape', 'Derivative rows must match condition-chain plan shape');
  assertCalibrationSelfTest(byId.get(17004)?.planTemplate === 'math_analytic_geometry_relation_v1', 'Analytic-geometry rows must map to the analytic geometry relation plan');
  assertCalibrationSelfTest(byId.get(17004)?.verdict === 'candidate_matches_analytic_geometry_relation_plan_shape', 'Analytic-geometry rows must match relation plan shape');
  assertCalibrationSelfTest(byId.get(17006)?.features?.transformationSignals >= 1, 'Statistics calibration must count combined, grouped, weighted, or transformed statistic wording as a reasoning move.');
  assertCalibrationSelfTest(byId.get(17006)?.features?.statisticsHardDirectCombinedVarianceRisk === true, 'Hard direct combined-variance rows must expose under-complexity risk.');
  assertCalibrationSelfTest(byId.get(17006)?.verdict === 'needs_hard_statistics_direct_combined_variance_repair', 'Hard direct combined-variance rows must require an additional independent condition.');
  return {
    mode: 'question_plan_calibration_math_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    summary,
    samples: evaluated
  };
}

function runChemistryCurrentCalibrationSelfTest() {
  const rows = [
    {
      id: 16240,
      cellId: '607',
      status: 'review_failed',
      difficulty: 'hard',
      topicTitle: '\u5e38\u89c1\u6c14\u4f53\u5236\u5907\u4e0e\u68c0\u9a8c',
      prompt: '\u5b9e\u9a8c\u5ba4\u5236\u5907Cl2\u65f6\u6df7\u6709HCl\u548c\u6c34\u84b8\u6c14\uff0c\u4f9d\u6b21\u901a\u8fc7\u9971\u548c\u98df\u76d0\u6c34\u3001\u6d53\u786b\u9178\u548c\u5c3e\u6c14\u5438\u6536\u88c5\u7f6e\u3002\u4e0b\u5217\u5173\u4e8e\u9664\u6742\u3001\u5e72\u71e5\u548c\u68c0\u9a8c\u7684\u5224\u65ad\u6b63\u786e\u7684\u662f\uff08 \uff09',
      explanation: '\u9700\u533a\u5206HCl\u7684\u9664\u53bb\u3001\u6c34\u84b8\u6c14\u7684\u5e72\u71e5\u4ee5\u53caCl2\u4f7f\u6e7f\u6da6\u84dd\u8272\u77f3\u854a\u8bd5\u7eb8\u5148\u53d8\u7ea2\u540e\u892a\u8272\u7684\u73b0\u8c61\uff0c\u5e76\u7528NaOH\u6eb6\u6db2\u5438\u6536\u5c3e\u6c14\u3002',
      gateReasons: ['profile_hard_multistep_evidence_missing'],
      profileReasons: []
    },
    {
      id: 16272,
      cellId: '608',
      status: 'pending_review',
      difficulty: 'basic',
      topicTitle: '\u5e38\u89c1\u6c14\u4f53\u5236\u5907\u4e0e\u68c0\u9a8c',
      prompt: '\u4e0b\u5217\u6c14\u4f53\u4e2d\uff0c\u65e2\u80fd\u7528\u5411\u4e0a\u6392\u7a7a\u6c14\u6cd5\u53c8\u80fd\u7528\u6392\u6c34\u6cd5\u6536\u96c6\u7684\u662f',
      explanation: 'O2\u5bc6\u5ea6\u7565\u5927\u4e8e\u7a7a\u6c14\u4e14\u4e0d\u6613\u6eb6\u4e8e\u6c34\uff0c\u53ef\u7528\u5411\u4e0a\u6392\u7a7a\u6c14\u6cd5\u548c\u6392\u6c34\u6cd5\u6536\u96c6\u3002',
      gateReasons: ['profile_difficulty_evidence_mismatch'],
      profileReasons: []
    },
    {
      id: 16247,
      cellId: '610',
      status: 'review_failed',
      difficulty: 'hard',
      topicTitle: '\u6c27\u5316\u8fd8\u539f\u53cd\u5e94\u5224\u65ad',
      prompt: '\u5411FeCl2\u6eb6\u6db2\u4e2d\u6ef4\u52a0\u6c2f\u6c34\uff0c\u518d\u52a0KSCN\u6eb6\u6db2\u540e\u53d8\u7ea2\uff1b\u52a0\u8fc7\u91cf\u94c1\u7c89\u540e\u7ea2\u8272\u6d88\u5931\u3002\u7ed3\u5408Cl2\u3001Fe3+\u548cFe\u7684\u6c27\u5316\u8fd8\u539f\u5173\u7cfb\uff0c\u4e0b\u5217\u5224\u65ad\u6b63\u786e\u7684\u662f\uff08 \uff09',
      explanation: '\u9700\u7528Cl2\u6c27\u5316Fe2+\u3001Fe3+\u4e0eSCN-\u663e\u8272\u3001Fe\u8fd8\u539fFe3+\u4e09\u6bb5\u8bc1\u636e\u4e32\u8054\u6392\u9664\u9009\u9879\u3002',
      gateReasons: ['profile_hard_calculation_evidence_missing', 'profile_hard_quantitative_shape_mismatch'],
      profileReasons: []
    },
    {
      id: 16286,
      cellId: '610',
      status: 'pending_review',
      difficulty: 'hard',
      topicTitle: '\u6c27\u5316\u8fd8\u539f\u53cd\u5e94\u5224\u65ad',
      prompt: '\u9178\u6027\u6761\u4ef6\u4e0b\uff0cKMnO4\u6eb6\u6db2\u5c060.30 mol Fe2+\u5b8c\u5168\u6c27\u5316\u4e3aFe3+\uff0c\u81ea\u8eab\u88ab\u8fd8\u539f\u4e3aMn2+\uff0c\u8fc7\u7a0b\u4e2d\u65e0\u5176\u4ed6\u6c27\u5316\u8fd8\u539f\u53cd\u5e94\u3002\u7406\u8bba\u4e0a\u9700\u6d88\u8017KMnO4\u7684\u7269\u8d28\u7684\u91cf\u662f\uff1f',
      explanation: 'MnO4-\u4e2dMn\u7531+7\u964d\u81f3+2\uff0c1 mol KMnO4\u5f975 mol\u7535\u5b50\uff1bFe2+\u6c27\u5316\u4e3aFe3+\uff0c1 mol Fe2+\u59311 mol\u7535\u5b50\u30020.30 mol Fe2+\u8f6c\u79fb0.30 mol\u7535\u5b50\uff0c\u9700KMnO4 0.060 mol\u3002',
      gateReasons: ['profile_difficulty_evidence_mismatch', 'profile_hard_calculation_evidence_missing', 'profile_hard_quantitative_shape_mismatch'],
      profileReasons: []
    },
    {
      id: 16263,
      cellId: '611',
      status: 'review_failed',
      difficulty: 'basic',
      topicTitle: '\u6c27\u5316\u8fd8\u539f\u53cd\u5e94\u5224\u65ad',
      prompt: '\u5728\u53cd\u5e94 2KClO3 = 2KCl + 3O2\u2191 \u4e2d\uff0c\u4e0b\u5217\u8bf4\u6cd5\u6b63\u786e\u7684\u662f\uff08 \uff09',
      explanation: 'Cl\u7531+5\u4ef7\u964d\u81f3-1\u4ef7\uff0cO\u7531-2\u4ef7\u5347\u81f30\u4ef7\uff0c\u636e\u6b64\u5224\u65ad\u6c27\u5316\u5242\u548c\u8fd8\u539f\u5242\u3002',
      gateReasons: ['review_failed'],
      profileReasons: []
    }
  ];
  const evaluated = rows.map((row) => {
    const features = candidateFeatures(row);
    const target = calibrationTarget(row, 'chemistry');
    return {
      id: Number(row.id),
      cellId: row.cellId,
      seedCellId: target?.seedCellId || null,
      taskFamily: target?.taskFamily || null,
      planTemplate: target?.planTemplate || null,
      status: row.status,
      difficulty: row.difficulty,
      topicTitle: row.topicTitle || null,
      family: row.family || null,
      verdict: calibrationVerdict(target, features, 'chemistry'),
      features,
      gateReasons: (row.gateReasons || []).map(qualityAuditDisplayReason),
      profileReasons: row.profileReasons || [],
      promptPreview: String(row.prompt || '').slice(0, 180)
    };
  });
  const byId = new Map(evaluated.map((item) => [item.id, item]));
  assertCalibrationSelfTest(byId.get(16240)?.verdict === 'maybe_hard_gas_impurity_control_plan', '#16240-style gas impurity chain must match hard gas plan shape');
  assertCalibrationSelfTest(byId.get(16272)?.verdict === 'candidate_matches_basic_gas_collection_or_test_rule', '#16272-style direct gas collection must remain a basic calibration verdict');
  assertCalibrationSelfTest(byId.get(16247)?.verdict === 'likely_direct_valence_judgement_missing_quant_chain', '#16247-style redox evidence chain without quantitative relation must not satisfy hard redox quant plan');
  assertCalibrationSelfTest(byId.get(16286)?.verdict === 'maybe_hard_redox_quant_chain_but_profile_mismatch', '#16286-style electron-transfer amount problem must surface as possible profile/rubric mismatch, not direct-valence drift');
  assertCalibrationSelfTest(byId.get(16263)?.verdict === 'candidate_matches_basic_redox_valence_rule', '#16263-style single redox equation must remain basic calibration');
  return {
    mode: 'question_plan_calibration_chemistry_current_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    summary: summarize(evaluated),
    samples: evaluated
  };
}

async function main() {
  if (hasFlag('self-test-math')) {
    const report = runMathCalibrationSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
    else console.log(`QuestionPlan calibration math self-test: ${report.status}, samples=${report.samples.length}`);
    return;
  }
  if (hasFlag('self-test-chemistry-current')) {
    const report = runChemistryCurrentCalibrationSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
    else console.log(`QuestionPlan calibration chemistry current self-test: ${report.status}, samples=${report.samples.length}`);
    return;
  }
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for read-only question-plan calibration.');
  const subject = String(argValue('subject', 'chemistry')).trim().toLowerCase();
  const runId = argValue('run', '198');
  if (!['chemistry', 'math'].includes(subject)) throw new Error('QuestionPlan calibration currently supports --subject=chemistry or --subject=math.');
  const configuredCells = argValue('cells', '').split(',').map((cell) => cell.trim()).filter(Boolean);
  const perCell = Math.max(1, Math.min(30, Number(argValue('per-cell', '10')) || 10));
  const includeCellHistory = hasFlag('include-cell-history');
  const historyDays = Math.max(1, Math.min(365, Number(argValue('history-days', '30')) || 30));
  const prisma = new PrismaClient();
  try {
    const querySubject = subject;
    const runCells = configuredCells.length > 0
      ? []
      : await prisma.$queryRawUnsafe(`
          SELECT id::text AS id
          FROM csca_subject_practice_production_cells
          WHERE run_id = $1::int AND subject = $2
          ORDER BY id
        `, runId, querySubject);
    const cellList = configuredCells.length > 0
      ? configuredCells
      : runCells.map((row) => String(row.id)).filter(Boolean);
    if (cellList.length === 0) throw new Error(`No production cells found for subject=${subject} run=${runId}.`);
    let coverageSource = 'current_run';
    let rows = await prisma.$queryRawUnsafe(`
      WITH ranked AS (
        SELECT q.id, q.status, q.topic_id AS "topicId", q.designed_difficulty AS "difficulty",
               q.generation_metadata->>'productionCellId' AS "cellId",
               t.title AS "topicTitle",
               COALESCE(q.generation_metadata->'questionFingerprint'->>'taskFamily', q.generation_metadata->>'taskFamily') AS "family",
               q.review_metadata->'gate'->'reasons' AS "gateReasons",
               q.review_metadata->'profileAlignment'->'reasons' AS "profileReasons",
               q.prompt, q.options, q.correct_answer AS "correctAnswer", q.explanation,
               ROW_NUMBER() OVER (PARTITION BY q.generation_metadata->>'productionCellId' ORDER BY q.updated_at DESC, q.id DESC) AS rn
        FROM csca_questions q
        LEFT JOIN csca_exam_topics t ON t.id = q.topic_id
        WHERE q.subject = $4
          AND q.generation_metadata->>'productionRunId' = $1
          AND q.generation_metadata->>'productionCellId' = ANY($2)
          AND q.status <> 'approved'
      )
      SELECT * FROM ranked WHERE rn <= $3 ORDER BY "cellId", rn
    `, runId, cellList, perCell, querySubject);
    const queryRecentCellHistory = () => prisma.$queryRawUnsafe(`
      WITH ranked AS (
        SELECT q.id, q.status, q.topic_id AS "topicId", q.designed_difficulty AS "difficulty",
               q.generation_metadata->>'productionCellId' AS "cellId",
               t.title AS "topicTitle",
               COALESCE(q.generation_metadata->'questionFingerprint'->>'taskFamily', q.generation_metadata->>'taskFamily') AS "family",
               q.review_metadata->'gate'->'reasons' AS "gateReasons",
               q.review_metadata->'profileAlignment'->'reasons' AS "profileReasons",
               q.prompt, q.options, q.correct_answer AS "correctAnswer", q.explanation,
               ROW_NUMBER() OVER (PARTITION BY q.generation_metadata->>'productionCellId' ORDER BY q.updated_at DESC, q.id DESC) AS rn
        FROM csca_questions q
        LEFT JOIN csca_exam_topics t ON t.id = q.topic_id
        WHERE q.subject = $4
          AND q.generation_metadata->>'productionCellId' = ANY($1)
          AND q.updated_at >= NOW() - ($2::int * INTERVAL '1 day')
          AND q.status <> 'approved'
      )
      SELECT * FROM ranked WHERE rn <= $3 ORDER BY "cellId", rn
    `, cellList, historyDays, perCell, querySubject);
    if (rows.length === 0 && includeCellHistory) {
      coverageSource = 'recent_cell_history_fallback_after_empty_current_run';
      rows = await queryRecentCellHistory();
    }
    const evaluateRows = (candidateRows) => candidateRows.flatMap((row) => {
      const features = subject === 'math' ? mathCandidateFeatures(row) : candidateFeatures(row);
      const family = subject === 'math'
        ? mathCalibrationFamily(row)
        : cleanText(subjectPracticeClassifyTaskFamily({
          subject,
          topicTitle: row.topicTitle,
          prompt: row.prompt,
          options: row.options,
          explanation: row.explanation
        }) || row.family);
      const target = calibrationTarget(row, subject, features);
      if (!target) return [];
      const basePlanInput = {
        subject,
        topicId: Number(row.topicId) || null,
        topicTitle: row.topicTitle,
        productionCellId: row.cellId,
        targetDifficulty: row.difficulty
      };
      const baseQuestionPlan = buildSubjectPracticeQuestionPlan(basePlanInput);
      const questionPlan = family && baseQuestionPlan && subjectPracticeQuestionPlanSupportsTaskFamily(baseQuestionPlan, family)
        ? buildSubjectPracticeQuestionPlan({ ...basePlanInput, taskFamily: family })
        : baseQuestionPlan;
      const questionPlanAdherence = questionPlan
        ? subjectPracticeQuestionPlanAdherenceFor(questionPlan, row)
        : null;
      return {
        id: Number(row.id),
        cellId: row.cellId,
        seedCellId: target?.seedCellId || null,
        taskFamily: target?.taskFamily || null,
        planTemplate: target?.planTemplate || null,
        status: row.status,
        difficulty: row.difficulty,
        topicTitle: row.topicTitle || null,
        family: family || null,
        verdict: calibrationVerdict(target, features, subject),
        questionPlanAdherence: questionPlanAdherence ? {
          adheres: questionPlanAdherence.adheres === true,
          planTemplate: questionPlanAdherence.planTemplate ?? questionPlan.planTemplate ?? null,
          taskFamily: questionPlanAdherence.taskFamily ?? questionPlan.taskFamily ?? null,
          failureCodes: arrayFrom(questionPlanAdherence.failureCodes)
        } : null,
        features,
        gateReasons: (row.gateReasons || []).map(qualityAuditDisplayReason),
        profileReasons: row.profileReasons || [],
        promptPreview: String(row.prompt || '').slice(0, 180)
      };
    });
    let evaluated = evaluateRows(rows);
    if (evaluated.length === 0 && includeCellHistory && coverageSource === 'current_run') {
      coverageSource = 'recent_cell_history_fallback_after_no_evaluable_current_run_sample';
      rows = await queryRecentCellHistory();
      evaluated = evaluateRows(rows);
    }
    const result = {
      mode: 'read_only_question_plan_calibration',
      status: evaluated.length > 0 ? 'sampled' : 'no_samples',
      subject,
      runId,
      cells: cellList,
      perCell,
      coverageSource,
      includeCellHistory,
      historyDays: includeCellHistory ? historyDays : null,
      sampleCount: evaluated.length,
      providerImpact: 'none_read_only_db_sampling',
      providerFailurePolicy: 'excluded_from_plan_quality_calibration',
      productionImpact: 'none_audit_only',
      summary: summarize(evaluated),
      samples: evaluated
    };
    if (hasFlag('json')) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`QuestionPlan calibration ${subject} run #${runId}: ${evaluated.length} rejected candidates sampled.`);
    for (const [cellId, cellSummary] of Object.entries(result.summary)) {
      console.log(`- cell #${cellId}: total=${cellSummary.total}, verdicts=${JSON.stringify(cellSummary.verdicts)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
