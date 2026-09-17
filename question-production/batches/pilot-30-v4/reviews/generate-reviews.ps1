$ErrorActionPreference = 'Stop'

$reviewerTaskId = '01a0956e-644c-7d11-9772-8cc443cf5aa8'
$reviewedAt = [DateTimeOffset]::Now.ToString('o')
$outDir = $PSScriptRoot

function Item {
  param(
    [string]$Id,
    [string]$Answer,
    [string]$Difficulty,
    [string]$Evidence,
    [string]$Verdict = 'pass',
    [string[]]$Reasons = @(),
    [bool]$Sufficient = $true,
    [bool]$Ambiguous = $false
  )
  [pscustomobject]@{
    id = $Id; answer = $Answer; difficulty = $Difficulty; evidence = $Evidence
    verdict = $Verdict; reasons = $Reasons; sufficient = $Sufficient; ambiguous = $Ambiguous
  }
}

$items = @(
  Item 'CQ-MATH-3001' 'A' 'medium' '由 f(0)=5a=10 得 a=2；对称轴 x=3，f(3)=2(2)(-2)=-8。仅 A 等于 -8，B/C/D 均不符。'
  Item 'CQ-MATH-3002' 'A' 'medium' '由 f(0)=a(2)(-4)=-16 得 a=2；对称轴 x=1，f(1)=2(3)(-3)=-18。仅 A 正确。'
  Item 'CQ-MATH-3003' 'C' 'medium' 'a8-a3=5d=15，故 d=3、a1=1；S10=10(1+28)/2=145。仅 C 正确。'
  Item 'CQ-MATH-3004' 'C' 'medium' '5d=a8-a3=-20，d=-4，a1=26、a10=-10；S10=10(26-10)/2=80。仅 C 正确。'
  Item 'CQ-MATH-3005' 'A' 'medium' '正项条件给 q>0；a5/a2=q^3=27，q=3，a1=2；S4=2+6+18+54=80。仅 A 正确。'
  Item 'CQ-MATH-3006' 'A' 'medium' 'q^3=96/12=8 且 q>0，故 q=2、a1=6；S4=6+12+24+48=90。仅 A 正确。'
  Item 'CQ-MATH-3007' 'C' 'medium' '至少选一项 60-8=52；两项都选 35+28-52=11；恰选一项 52-11=41。仅 C 正确。'
  Item 'CQ-MATH-3008' 'C' 'medium' '至少选一项 80-12=68；交集 45+38-68=15；恰选一项 68-15=53。仅 C 正确。'
  Item 'CQ-MATH-3009' 'A' 'medium' '不放回取两球恰一红的概率为 C(4,1)C(6,1)/C(10,2)=24/45=8/15。仅 A 与精确值相等。'
  Item 'CQ-MATH-3010' 'A' 'medium' '概率为 C(3,1)C(5,1)/C(8,2)=15/28。仅 A 正确；D 的小数也不等于该值。'
  Item 'CQ-MATH-3011' 'C' 'medium' '垂直给 3k+2(-6)=0，k=4；|a|=sqrt(4^2+2^2)=2sqrt(5)。仅 C 正确。'
  Item 'CQ-MATH-3012' 'C' 'medium' '垂直给 4k+(-3)8=0，k=6；|a|=sqrt(36+9)=3sqrt(5)。仅 C 正确。'
  Item 'CQ-MATH-3013' 'A' 'medium' '半弦、圆心距和半径构成直角三角形；弦长=2sqrt(5^2-3^2)=8。仅 A 正确。'
  Item 'CQ-MATH-3014' 'A' 'medium' '弦长=2sqrt(13^2-5^2)=2sqrt(144)=24。仅 A 正确。'
  Item 'CQ-MATH-3015' 'C' 'medium' '第二象限 cosα=-4/5；tan(α/2)=sinα/(1+cosα)=3。仅 C 正确，但两步标准公式题不足以支撑 hard 标注。' 'reject' @('DIFFICULTY_OVERSTATED')
  Item 'CQ-MATH-3016' 'C' 'medium' '第三象限 cosα=-12/13；tan(α/2)=(-5/13)/(1/13)=-5。仅 C 正确，但推理复杂度为常规中等。' 'reject' @('DIFFICULTY_OVERSTATED')
  Item 'CQ-MATH-3017' 'A' 'medium' '定义域 x>3；合并得 (x-1)(x-3)=8，即 x^2-4x-5=0，根 5、-1，仅 5 合域。仅 A 正确。'
  Item 'CQ-MATH-3018' 'abstain' 'uncertain' '“log_3(x--1)”含连续两个减号，既非规范数学排版，也未用括号明确表示 x-(-1)。若按 x+1 解得 x=2（A），但题面本身不足以唯一确认该解释，故不猜。' 'abstain' @('AMBIGUOUS_NOTATION','NONSTANDARD_DOUBLE_MINUS') $false $true
  Item 'CQ-MATH-3019' 'C' 'hard' '总体均值为 8；组内离差平方和 10×4+20×1=60，组间为 10(6-8)^2+20(9-8)^2=60；总方差 120/30=4。仅 C 正确。'
  Item 'CQ-MATH-3020' 'C' 'hard' '总体均值 (8×5+12×10)/20=8；组内和 8×2+12×3=52，组间和 8×9+12×4=120；方差 172/20=8.6。仅 C 正确。'

  Item 'CQ-PHYSICS-3001' 'A' 'medium' '竖直落地分速度 sqrt(2gh)=20 m/s，水平分速度仍为 10 m/s；合速度 sqrt(20^2+10^2)=10sqrt(5) m/s。仅 A 正确。'
  Item 'CQ-PHYSICS-3002' 'A' 'medium' '竖直分速度 sqrt(2×10×45)=30 m/s；与 15 m/s 水平分速度合成得 15sqrt(5) m/s。仅 A 正确。'
  Item 'CQ-PHYSICS-3003' 'C' 'medium' '合功 (10-2)×4=32 J；由 32=mv^2/2=v^2 得 v=4sqrt(2) m/s。仅 C 正确；A 对应忽略摩擦且数值还有轻微舍入偏差。'
  Item 'CQ-PHYSICS-3004' 'C' 'medium' '合功 (30-5)×10=250 J；250=(1/2)×5v^2，得 v=10 m/s。仅 C 正确。'
  Item 'CQ-PHYSICS-3005' 'A' 'medium' '动量守恒：(2×6+1×0)/(2+1)=4 m/s，方向向右。仅 A 正确。'
  Item 'CQ-PHYSICS-3006' 'A' 'medium' '向左初速取负：(3×5+2×(-1))/5=13/5=2.6 m/s。仅 A 正确。'
  Item 'CQ-PHYSICS-3007' 'C' 'medium' '6 Ω 与 3 Ω 并联等效 2 Ω，再串联 4 Ω 得 6 Ω；总电流 12/6=2 A。仅 C 正确。'
  Item 'CQ-PHYSICS-3008' 'C' 'medium' '12 Ω 与 4 Ω 并联等效 3 Ω，再串联 2 Ω 得 5 Ω；总电流 15/5=3 A。仅 C 正确。'
  Item 'CQ-PHYSICS-3009' 'A' 'medium' '设零场点距左电荷 x，则 kq/x^2=4kq/(6-x)^2；区间内取正长度得 6-x=2x，x=2 m。仅 A 正确，但属单方程常规模型，hard 标注偏高。' 'reject' @('DIFFICULTY_OVERSTATED')
  Item 'CQ-PHYSICS-3010' 'A' 'medium' '设距左侧 x：9/x^2=4/(10-x)^2，取区间内正根 3/x=2/(10-x)，得 x=6 m。仅 A 正确，难度为中等而非 hard。' 'reject' @('DIFFICULTY_OVERSTATED')
  Item 'CQ-PHYSICS-3011' 'C' 'medium' '漂浮时 ρ物Vg=ρ水(0.75V)g，故 ρ物=750 kg/m^3。仅 C 正确。'
  Item 'CQ-PHYSICS-3012' 'C' 'medium' '浸没体积分数为 1-40%=60%；漂浮平衡给 ρ物=0.60ρ水=600 kg/m^3。仅 C 正确。'
  Item 'CQ-PHYSICS-3013' 'A' 'medium' '薄透镜公式 1/10=1/30+1/v 得 v=15 cm；放大率绝对值 |v/u|=15/30=0.5。仅 A 正确。'
  Item 'CQ-PHYSICS-3014' 'A' 'medium' '1/12=1/18+1/v，得 v=36 cm；|v/u|=36/18=2。仅 A 正确。'
  Item 'CQ-PHYSICS-3015' 'C' 'medium' '两端固定且含 3 个半波：L=3λ/2，λ=0.8 m；v=fλ=150×0.8=120 m/s。仅 C 正确。'
  Item 'CQ-PHYSICS-3016' 'C' 'medium' 'L=5λ/2，故 λ=2×0.75/5=0.3 m；v=500×0.3=150 m/s。仅 C 正确。'
  Item 'CQ-PHYSICS-3017' 'A' 'medium' '金属与水的热容均为 168 J/℃；绝热平衡温度为等热容加权平均 (80+20)/2=50 ℃。仅 A 正确。'
  Item 'CQ-PHYSICS-3018' 'A' 'medium' '两者热容均为 336 J/℃；平衡温度 (70+10)/2=40 ℃。仅 A 正确。'
  Item 'CQ-PHYSICS-3019' 'C' 'medium' '洛伦兹力提供向心力，r=mv/(|q|B)=(2×10^-6×6)/(4×10^-5×0.5)=0.6 m。仅 C 正确。'
  Item 'CQ-PHYSICS-3020' 'C' 'medium' 'r=mv/(|q|B)=(3×10^-6×4)/(2×10^-5×0.8)=0.75 m。仅 C 正确。'

  Item 'CQ-CHEMISTRY-3001' 'A' 'medium' '按 2H2+O2→2H2O，3 mol H2 需 1.5 mol O2，故 H2 限量并生成 3 mol 水；质量 3×18=54 g。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3002' 'A' 'medium' '2 mol O2 最多消耗 4 mol H2 并生成 4 mol H2O；质量 4×18=72 g。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3003' 'C' 'medium' '若采用常用 M(CaCO3)=100 g/mol，则纯 CaCO3 为 8 g、0.08 mol，生成 CO2 0.08 mol，即 1.792 L（C）。但题面未给 CaCO3 摩尔质量/相对原子质量，且声明不允许外部语境，条件不自足。' 'reject' @('MISSING_MOLAR_MASS_DATA','CONDITIONS_INSUFFICIENT') $false
  Item 'CQ-CHEMISTRY-3004' 'C' 'medium' '若采用 M(CaCO3)=100 g/mol，则 25×60%=15 g=0.15 mol，生成 CO2 体积 0.15×22.4=3.36 L（C）。题面未提供所需摩尔质量数据。' 'reject' @('MISSING_MOLAR_MASS_DATA','CONDITIONS_INSUFFICIENT') $false
  Item 'CQ-CHEMISTRY-3005' 'A' 'hard' '按常用原子量计算：n(C)=8.8/44=0.2，n(H)=2×5.4/18=0.6；样品中 O 质量=4.6-2.4-0.6=1.6 g，即 0.1 mol，原子比 2:6:1，A。题面未给 CO2/H2O 摩尔质量或 C/H/O 相对原子质量。' 'reject' @('MISSING_ATOMIC_MASS_DATA','CONDITIONS_INSUFFICIENT') $false
  Item 'CQ-CHEMISTRY-3006' 'A' 'hard' '按常用原子量：n(C)=8.8/44=0.2，n(H)=2×3.6/18=0.4，氧质量=6-2.4-0.4=3.2 g 即 0.2 mol，原子比 1:2:1，A。必要原子量/摩尔质量未在题面给出。' 'reject' @('MISSING_ATOMIC_MASS_DATA','CONDITIONS_INSUFFICIENT') $false
  Item 'CQ-CHEMISTRY-3007' 'C' 'medium' '0.02 mol MnO4- 得电子 0.02×5=0.10 mol；每 mol Fe2+ 失 1 mol 电子，故 Fe2+ 为 0.10 mol。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3008' 'C' 'medium' '0.015 mol Cr2O7^2- 接受 0.015×6=0.09 mol 电子，对应氧化 0.09 mol Fe2+。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3009' 'A' 'hard' '1 L 中平衡浓度为 [A]=0.3、[B]=0.2、[C]=0.2 mol/L；Kc=0.2/(0.3×0.2)=10/3。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3010' 'A' 'hard' '平衡时 [A]=0.3、[B]=0.2、[C]=0.3 mol/L；Kc=0.3/(0.3×0.2)=5。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3011' 'C' 'medium' '200 g 水在高、低温分别可溶 160 g、60 g；析出 160-60=100 g。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3012' 'C' 'medium' '150 g 水在高温溶 90 g，低温溶 30 g；析出 60 g。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3013' 'A' 'medium' '电子物质的量 Q/F=19300/96500=0.2 mol；Cu2+ 需 2 e-，析出 Cu 0.1 mol，质量 6.4 g。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3014' 'A' 'medium' 'Q/F=0.1 mol e-；Ag+ 与电子 1:1，析出 0.1 mol Ag，质量 10.8 g。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3015' 'C' 'medium' '目标反应=反应1+反应2的逆反应，ΔH=-394+283=-111 kJ/mol。仅 C 正确；只需一次反转相加，hard 标注明显偏高。' 'reject' @('DIFFICULTY_OVERSTATED')
  Item 'CQ-CHEMISTRY-3016' 'C' 'hard' '元素生成 CO2+2H2O 的焓变为 -394-572=-966；它也等于 CH4 生成焓加燃烧焓 -890，故 ΔHf(CH4)=-76 kJ/mol。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3017' 'A' 'medium' '每 0.1 mol 烃生成 0.3 mol CO2，故每分子含 3 C；生成 0.4 mol H2O 对应每分子 8 H，分子式 C3H8。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3018' 'A' 'medium' '每 mol 烃对应 4 mol CO2 和 5 mol H2O，故含 C4H10。仅 A 正确。'
  Item 'CQ-CHEMISTRY-3019' 'C' 'medium' '取 1 L 溶液，质量 1.2×1000=1200 g，溶质 240 g=4 mol；浓度 4 mol/L。仅 C 正确。'
  Item 'CQ-CHEMISTRY-3020' 'C' 'medium' '1 L 溶液质量 1100 g，溶质 110 g=2 mol；浓度 2 mol/L。仅 C 正确。'
)

foreach ($item in $items) {
  $truth = [ordered]@{ A = $false; B = $false; C = $false; D = $false }
  if ($item.answer -ne 'abstain') { $truth[$item.answer] = $true }
  $review = [ordered]@{
    schemaVersion = 'codex-blind-review-v1'
    candidateId = $item.id
    reviewerTaskId = $reviewerTaskId
    derivedAnswer = $item.answer
    optionTruthTable = $truth
    conditionsSufficient = $item.sufficient
    ambiguityFound = $item.ambiguous
    syllabusAligned = $true
    difficultyAssessment = $item.difficulty
    caseNecessary = $true
    counterexampleAttempted = $true
    verificationEvidence = @($item.evidence, '已逐项对照 A/B/C/D；真值表只标记由题干独立推出的选项，未采用任何题面或元数据自报答案。')
    verdictBeforeReveal = $item.verdict
    reasonCodes = @($item.reasons)
    reviewedAt = $reviewedAt
  }
  $path = Join-Path $outDir ($item.id + '.review.json')
  $review | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding utf8
}

$subjectRows = foreach ($subject in @('MATH','PHYSICS','CHEMISTRY')) {
  $group = @($items | Where-Object { $_.id -like "CQ-$subject-*" })
  [ordered]@{
    subject = $subject.ToLowerInvariant()
    total = $group.Count
    pass = @($group | Where-Object verdict -eq 'pass').Count
    reject = @($group | Where-Object verdict -eq 'reject').Count
    abstain = @($group | Where-Object verdict -eq 'abstain').Count
    difficultyDeviations = @($group | Where-Object { $_.reasons -contains 'DIFFICULTY_OVERSTATED' } | ForEach-Object id)
    nonPassItems = @($group | Where-Object verdict -ne 'pass' | ForEach-Object { [ordered]@{ candidateId=$_.id; verdict=$_.verdict; reasonCodes=@($_.reasons) } })
  }
}

$manifest = [ordered]@{
  schemaVersion = 'codex-blind-review-manifest-v1'
  batch = 'pilot-30-v4'
  reviewerTaskId = $reviewerTaskId
  languageReviewed = 'zh'
  scope = [ordered]@{ itemCount=60; subjects=@('math','physics','chemistry'); blindOnly=$true }
  subjectStatistics = @($subjectRows)
  majorDefects = @(
    [ordered]@{ code='CONDITIONS_INSUFFICIENT'; items=@('CQ-CHEMISTRY-3003','CQ-CHEMISTRY-3004','CQ-CHEMISTRY-3005','CQ-CHEMISTRY-3006'); observation='题面在声明无外部语境的同时遗漏完成定量计算所需的摩尔质量或相对原子质量。' },
    [ordered]@{ code='AMBIGUOUS_NOTATION'; items=@('CQ-MATH-3018'); observation='连续双减号 x--1 不是规范数学表达，未以括号明确负数。' },
    [ordered]@{ code='DIFFICULTY_OVERSTATED'; items=@('CQ-MATH-3015','CQ-MATH-3016','CQ-PHYSICS-3009','CQ-PHYSICS-3010','CQ-CHEMISTRY-3015'); observation='均为标准公式/单方程的常规两步推理，更符合 medium。' }
  )
  structuralClusterObservations = @(
    '60 题由 30 个结构簇组成，每簇恰有 2 题，簇内 structureFingerprint、任务骨架、措辞和干扰项角色高度一致，仅替换参数。',
    '数学、物理、化学各 10 个结构簇；这种成对模板化使覆盖面表面为 20 题/科，但独立结构仅 10 个/科，存在明显同质化风险。',
    '所有题均为纯文本且不依赖缺失图像；除数学 3018 外，没有发现必须依赖未说明图形约定才能作答的题。',
    '现实/假设场景中的数值总体量级合理，题干给出的场景参数均参与计算；多数题仍是参数替换型，情境较薄但非纯装饰。',
    '干扰项总体可对应常见错误（漏步骤、错比例、错单位或混淆中间量）；少数长小数干扰项显得机械，但未造成第二正确答案。'
  )
  prohibitedAccessDeclaration = '评审过程中仅读取 question-production/batches/pilot-30-v4/blind/、question-production/schemas/blind-review.schema.json，并为确认必要 schema 文件名列出 question-production/schemas/；未访问 Git 历史、其他分支、sealed、V1-V3、旧 reviews、生成任务、accepted/audit、官方语料、数据库题文或工作区其他题。答案目录未被访问。'
  reviewedAt = $reviewedAt
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outDir 'reviewer-manifest.json') -Encoding utf8

Write-Output "Generated $($items.Count) reviews and reviewer-manifest.json"
