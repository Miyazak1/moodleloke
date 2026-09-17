$ErrorActionPreference = 'Stop'

$reviewerTaskId = '01a0a489-caf4-75e3-8c3a-a92ea323f53c'
$reviewedAt = [DateTimeOffset]::Now.ToString('o')
$outputDir = $PSScriptRoot

function Add-Review {
  param(
    [string]$Id,
    [string]$Answer,
    [string]$Difficulty,
    [bool]$ConditionsSufficient,
    [bool]$AmbiguityFound,
    [bool]$CaseNecessary,
    [string]$Verdict,
    [string[]]$ReasonCodes,
    [string[]]$Evidence
  )

  $truth = [ordered]@{ A = $false; B = $false; C = $false; D = $false }
  if ($Answer -ne 'abstain') { $truth[$Answer] = $true }

  $review = [ordered]@{
    schemaVersion = 'codex-blind-review-v1'
    candidateId = $Id
    reviewerTaskId = $reviewerTaskId
    derivedAnswer = $Answer
    optionTruthTable = $truth
    conditionsSufficient = $ConditionsSufficient
    ambiguityFound = $AmbiguityFound
    syllabusAligned = $true
    difficultyAssessment = $Difficulty
    caseNecessary = $CaseNecessary
    counterexampleAttempted = $true
    verificationEvidence = $Evidence
    verdictBeforeReveal = $Verdict
    reasonCodes = $ReasonCodes
    reviewedAt = $reviewedAt
  }

  $path = Join-Path $outputDir ($Id + '.review.json')
  $review | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
}

Add-Review 'CQ-PHYSICS-2001' 'A' 'basic' $true $false $true 'pass' @() @(
  '匀速直线运动：v=|s|/t=25 m/5 s=5 m/s，只有 A 符合。',
  '反查 A：5 m/s×5 s=25 m；B、C、D 分别对应 30、20、35 m，均不符。位移方向未给但题目只求速度大小，不影响唯一性。'
)
Add-Review 'CQ-PHYSICS-2002' 'B' 'basic' $true $false $true 'pass' @() @(
  '匀速直线运动：v=18 m/3 s=6 m/s，只有 B 符合。',
  '反查四项与 3 s 相乘，仅 B 给出 18 m；单位一致，求速度大小无方向歧义。'
)
Add-Review 'CQ-PHYSICS-2003' 'C' 'basic' $true $false $true 'pass' @() @(
  '匀速直线运动：v=35 m/5 s=7 m/s，只有 C 符合。',
  '反查 C：7×5=35 m；其余选项分别产生 40、30、45 m。题设明确匀速。'
)
Add-Review 'CQ-PHYSICS-2004' 'D' 'basic' $true $false $true 'pass' @() @(
  '匀速直线运动：v=56 m/7 s=8 m/s，只有 D 符合。',
  '反查 D：8×7=56 m；其余选项不满足给定位移与时间。数值和单位无舍入问题。'
)
Add-Review 'CQ-PHYSICS-2005' 'B' 'basic' $true $false $true 'pass' @() @(
  '题面明确加速度恒定，a=(v-v0)/t=(14-6)/8=1 m/s^2，只有 B 符合。',
  '反查 B：6+1×8=14 m/s；A、C、D 会给出 22、6、30 m/s。场景速度对矿区运输虽偏高但并非物理上不合理。'
)
Add-Review 'CQ-PHYSICS-2006' 'D' 'basic' $true $false $true 'pass' @() @(
  '题面明确加速度恒定，a=(0-4)/4=-1 m/s^2，只有 D 符合。',
  '反查 D：4+(-1)×4=0 m/s；负号正确表示选定正方向上的减速。其余项均不满足末速度。'
)
Add-Review 'CQ-PHYSICS-2007' 'B' 'basic' $true $false $false 'reject' @('scenario_implausible','contrived_operational_use') @(
  '按给定恒加速度条件，a=(6-2)/4=1 m/s^2，数值上只有 B 正确。',
  '反查 B 可得末速度 6 m/s；A、C、D 分别给 10、2、14 m/s。',
  '案例缺陷：医院无菌物资直廊内配送机器人在 4 s 内加速至 6 m/s（21.6 km/h）明显不符合人员共用病区走廊的安全运行常识；把该计算用于“安排物资交接”也缺少真实决策联系。'
)
Add-Review 'CQ-PHYSICS-2008' 'C' 'basic' $true $false $false 'reject' @('scenario_implausible','contrived_operational_use') @(
  '按给定恒加速度条件，a=(9-3)/6=1 m/s^2，数值上只有 C 正确。',
  '反查 C 可得末速度 9 m/s；其余选项均不匹配。',
  '案例缺陷：温室栽培行内轨道喷雾机达到 9 m/s（32.4 km/h）不符合喷雾覆盖、作物与人员安全的常见作业尺度，“用于设置处理批次”与加速度结果之间也没有清晰用途链。'
)
Add-Review 'CQ-PHYSICS-2009' 'A' 'basic' $true $false $false 'reject' @('scenario_implausible','contrived_operational_use') @(
  '恒加速度运动：v=v0+at=3+1×4=7 m/s，数值上只有 A 正确。',
  '反查 A 满足给定初速度、加速度和时间；B、C、D 均不满足。',
  '案例缺陷：工厂装配轨道上输送构件的装配桁车达到 7 m/s（25.2 km/h）与精确定位和工业安全场景明显不相称，“协调构件定位”的用途表述因此显得为套公式而拼接。'
)
Add-Review 'CQ-PHYSICS-2010' 'B' 'basic' $true $false $true 'pass' @() @(
  '恒加速度运动：v=2+1×4=6 m/s，只有 B 符合。',
  '反查 B 满足 v-v0=at=4 m/s；其余三项不满足。题设明确恒加速度，概念无平均/瞬时混淆。'
)
Add-Review 'CQ-PHYSICS-2011' 'C' 'basic' $true $false $true 'pass' @() @(
  '恒加速度运动：v=3+1×6=9 m/s，只有 C 符合。',
  '反查 C：速度增量为 6 m/s，与 1 m/s^2×6 s 一致。封闭测试道场景可容纳该速度。'
)
Add-Review 'CQ-PHYSICS-2012' 'D' 'basic' $true $false $true 'pass' @() @(
  '恒加速度运动：v=4+1×8=12 m/s，只有 D 符合。',
  '反查 D：12-4=8 m/s=1 m/s^2×8 s；其余选项不符。铁路直线试验段语境与运动条件相容。'
)
Add-Review 'CQ-PHYSICS-2013' 'D' 'basic' $true $false $true 'pass' @() @(
  '题面明确恒加速度，s=v0t+(1/2)at^2=2×2+0.5×1×2^2=6 m，只有 D 符合。',
  '用平均速度反查：(2+4)/2×2=6 m；A、B、C 均不满足。没有把平均速度误作初速度或末速度。'
)
Add-Review 'CQ-PHYSICS-2014' 'C' 'basic' $true $false $true 'pass' @() @(
  '恒加速度位移 s=4×3+0.5×1×3^2=16.5 m，只有 C 符合。',
  '末速度为 7 m/s，以平均速度 (4+7)/2×3=16.5 m 交叉验证；单位与小数表达一致。'
)
Add-Review 'CQ-PHYSICS-2015' 'D' 'basic' $true $false $true 'pass' @() @(
  '恒加速度位移 s=3×3+0.5×1×3^2=13.5 m，只有 D 符合。',
  '末速度为 6 m/s，以平均速度 (3+6)/2×3=13.5 m 交叉验证；其余选项不符。'
)

Add-Review 'CQ-CHEMISTRY-2001' 'A' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [H+]=0.08×50/1250=0.0032 mol/L，pH=-lg(0.0032)=2.49485，约为 2.49，只有 A 符合。',
  '反算 10^-2.49≈3.24×10^-3 mol/L，与物料衡算值一致；其余选项相差约 0.5 的 pH 单位。'
)
Add-Review 'CQ-CHEMISTRY-2002' 'B' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [H+]=0.2×20/1000=0.004 mol/L，pH=2.39794，按一位小数约为 2.4，只有 B 符合。',
  '物质的量 0.004 mol 除以终体积 1.000 L 得 0.004 mol/L；选项精度一致。'
)
Add-Review 'CQ-CHEMISTRY-2003' 'C' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [H+]=0.02×5/500=2.0×10^-4 mol/L，pH=3.69897，约为 3.7，只有 C 符合。',
  '稀释倍数为 100，初始 pH 1.699 增加 2 得 3.699，构成独立反查。'
)
Add-Review 'CQ-CHEMISTRY-2004' 'D' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [H+]=0.05×25/2500=5.0×10^-4 mol/L，pH=3.30103，约为 3.3，只有 D 符合。',
  '稀释倍数 100，使初始 pH 1.301 增加 2；单位换算在体积比中相消。'
)
Add-Review 'CQ-CHEMISTRY-2005' 'A' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [H+]=0.2×5/50=0.02 mol/L，pH=1.69897，约为 1.7，只有 A 符合。',
  '十倍稀释令初始 pH 0.699 增加 1，得到 1.699；其余选项均不符。'
)
Add-Review 'CQ-CHEMISTRY-2006' 'B' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [OH-]=0.01×40/400=0.001 mol/L，pOH=3；25°C 下 pH=14-3=11，只有 B 符合。',
  '题面明确 25°C 和完全电离，所用 pKw=14 的条件充分；其他选项与浓度不符。'
)
Add-Review 'CQ-CHEMISTRY-2007' 'C' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [OH-]=0.05×10/200=0.0025 mol/L，pOH=2.60206，25°C 下 pH=11.39794，约为 11.4，只有 C 符合。',
  '反算 pH 11.4 对应 [OH-]≈2.51×10^-3 mol/L，与稀释衡算一致。'
)
Add-Review 'CQ-CHEMISTRY-2008' 'D' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [OH-]=0.1×40/800=0.005 mol/L，pOH=2.30103，25°C 下 pH=11.69897，约为 11.7，只有 D 符合。',
  '20 倍稀释后的氢氧根浓度与 D 反算值一致；选项间隔足以排除舍入歧义。'
)
Add-Review 'CQ-CHEMISTRY-2009' 'A' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [OH-]=0.01×20/500=4.0×10^-4 mol/L，pOH=3.39794，25°C 下 pH=10.60206，约为 10.6，只有 A 符合。',
  '反算 pH 10.6 得 pOH 3.4、[OH-]≈3.98×10^-4 mol/L，与物料衡算吻合。'
)
Add-Review 'CQ-CHEMISTRY-2010' 'B' 'basic' $true $false $true 'pass' @() @(
  '稀释后 [OH-]=0.04×50/1250=0.0016 mol/L，pOH=2.79588，25°C 下 pH=11.20412，约为 11.2，只有 B 符合。',
  '25 倍稀释与 B 的反算浓度一致；其余选项相差 0.5 pH 单位。'
)
Add-Review 'CQ-CHEMISTRY-2011' 'abstain' 'medium' $false $true $true 'reject' @('missing_temperature','ambiguous_numeric_ph') @(
  '先做计量关系：n(HCl)=0.040×0.05=0.002 mol，n(NaOH)=0.025×0.25=0.00625 mol，混合后 [OH-]=(0.00625-0.002)/0.065=0.06538 mol/L，pOH≈1.1845。',
  '题目未给温度，却要求碱性混合液的数值 pH；需用 pH=pKw(T)-pOH。只有额外假定 25°C、pKw=14 时才得 pH≈12.82（C）。不同温度下 pKw 改变，可落到不同选项附近，因此不能从题面唯一推出 A-D 中的一项。'
)
Add-Review 'CQ-CHEMISTRY-2012' 'D' 'medium' $true $false $true 'pass' @() @(
  'n(HCl)=0.010×0.2=0.002 mol，n(NaOH)=0.030×0.06=0.0018 mol；过量 H+ 为 0.0002 mol，总体积 0.040 L，[H+]=0.005 mol/L。',
  'pH=-lg(0.005)=2.30103，约为 2.3，只有 D 符合。结果由过量强酸浓度直接确定，不需用 pKw。'
)
Add-Review 'CQ-CHEMISTRY-2013' 'abstain' 'medium' $false $true $true 'reject' @('missing_temperature','ambiguous_numeric_ph') @(
  'n(HCl)=0.015×0.15=0.00225 mol，n(NaOH)=0.030×0.18=0.0054 mol；混合后 [OH-]=(0.0054-0.00225)/0.045=0.0700 mol/L，pOH≈1.1549。',
  '题目未给温度，碱过量体系的 pH 必须由 pKw(T)-pOH 得到。仅在 25°C 假定下为 12.85（A）；温度变化可改变到其他选项范围，故题面条件不足以唯一选择。'
)
Add-Review 'CQ-CHEMISTRY-2014' 'B' 'medium' $true $false $true 'pass' @() @(
  'n(HCl)=0.025×0.12=0.003 mol，n(NaOH)=0.030×0.06=0.0018 mol；过量 H+ 为 0.0012 mol，总体积 0.055 L，[H+]=0.021818 mol/L。',
  'pH=-lg(0.021818)=1.66118，约为 1.66，只有 B 符合。以各选项反算 [H+] 也只有 B 满足物料衡算。'
)
Add-Review 'CQ-CHEMISTRY-2015' 'abstain' 'medium' $false $true $true 'reject' @('missing_temperature','ambiguous_numeric_ph') @(
  'n(HCl)=0.030×0.1=0.003 mol，n(NaOH)=0.030×0.18=0.0054 mol；混合后 [OH-]=(0.0054-0.003)/0.060=0.0400 mol/L，pOH≈1.39794。',
  '题目未给温度，数值 pH 需由 pKw(T)-pOH 决定。只有补充 25°C 假定时才得 12.60（C）；现有条件下答案不唯一，因此不猜选项。'
)

$manifest = [ordered]@{
  schemaVersion = 'codex-blind-review-manifest-v1'
  reviewerTaskId = $reviewerTaskId
  batchId = 'pilot-30-v3'
  scope = [ordered]@{
    language = 'zh-CN'
    total = 30
    physics = 15
    chemistry = 15
  }
  summary = [ordered]@{
    physics = [ordered]@{ pass = 12; reject = 3; abstain = 0 }
    chemistry = [ordered]@{ pass = 12; reject = 3; abstain = 0 }
    total = [ordered]@{ pass = 24; reject = 6; abstain = 0 }
  }
  rejected = @(
    [ordered]@{ candidateId = 'CQ-PHYSICS-2007'; reason = '医院病区直廊配送机器人加速至 6 m/s，作业速度与安全场景明显不相称，计算用途牵强。' },
    [ordered]@{ candidateId = 'CQ-PHYSICS-2008'; reason = '温室轨道喷雾机加速至 9 m/s，违背喷雾覆盖和温室作业常见尺度，计算用途牵强。' },
    [ordered]@{ candidateId = 'CQ-PHYSICS-2009'; reason = '装配桁车输送构件时达到 7 m/s，与精确定位和工业安全场景明显不相称。' },
    [ordered]@{ candidateId = 'CQ-CHEMISTRY-2011'; reason = '碱过量体系求数值 pH 未给温度，pKw(T) 不确定；25°C 答案不能由题面独立推出。' },
    [ordered]@{ candidateId = 'CQ-CHEMISTRY-2013'; reason = '碱过量体系求数值 pH 未给温度，pKw(T) 不确定；25°C 答案不能由题面独立推出。' },
    [ordered]@{ candidateId = 'CQ-CHEMISTRY-2015'; reason = '碱过量体系求数值 pH 未给温度，pKw(T) 不确定；25°C 答案不能由题面独立推出。' }
  )
  abstained = @()
  majorIssues = @(
    [ordered]@{ code = 'scenario_implausible'; count = 3; detail = '部分物理题给出的设备速度显著超出相应医院、温室或装配定位场景的合理作业尺度。' },
    [ordered]@{ code = 'missing_temperature'; count = 3; detail = '三道碱过量中和题未声明 25°C，却要求两位小数的 pH；pH 依赖 pKw(T)。' },
    [ordered]@{ code = 'difficulty_calibration'; count = 10; detail = '化学 2001-2010 为单次稀释加一次对数换算，独立评估更接近 basic，而非标注的 medium；不影响唯一性，未据此拒绝。' }
  )
  integrityDeclaration = [ordered]@{
    answersAccessed = $false
    gitHistoryAccessed = $false
    sealedDirectoryAccessed = $false
    priorReviewsAccessed = $false
    officialQuestionCorpusAccessed = $false
    englishVersionReviewed = $false
  }
  reviewedAt = $reviewedAt
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputDir 'reviewer-manifest.json') -Encoding UTF8

