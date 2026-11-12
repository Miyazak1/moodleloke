'use strict';
// Scope: read-only current LOCAL bank + deduplicated LOCAL historical CSV exports.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {readRows}=require('./question-figure-inventory.cjs');
const {hash}=require('../question-engine/figures/binding.cjs');
const {extract,requiresFigure}=require('../question-engine/figures/external.cjs');
const {isStandardStudentChoiceQuestion}=require('../backend/dist/backend/src/csca-special-practice/student-question-eligibility.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/question-figures');
function docker(args){const r=spawnSync('docker',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});if(r.error)throw r.error;if(r.status)throw Error('Local read-only inventory failed: '+r.stderr);return r.stdout.trim();}
const context=docker(['context','show']);if(!/^(npipe|unix):\/\//.test(JSON.parse(docker(['context','inspect',context]))[0].Endpoints.docker.Host))throw Error('Remote Docker inventory forbidden');
const query=`BEGIN READ ONLY; SELECT json_build_object(
'questionSources',(SELECT json_agg(s) FROM (SELECT source_type,subject,status,count(*) AS count FROM csca_questions GROUP BY 1,2,3 ORDER BY 1,2,3)s),
'specialPracticeQuestions',(SELECT count(*) FROM special_practice_questions),'mockExamQuestions',(SELECT count(*) FROM mock_exam_questions),
'sourceDocuments',(SELECT count(*) FROM csca_source_documents),'sourceQuestions',(SELECT count(*) FROM csca_source_questions),
'pastPaperFileRecords',(SELECT count(*) FROM past_paper_files)); COMMIT;`;
const raw=docker(['exec','moodlelike-postgres','psql','-U','postgres','-d','moodlelike','-At','-c',query]);
const main=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
const base=path.join(root,'.local/external-oer-migrations'),seen=new Map(),exportFiles=[];let questions=[];
for(const dir of fs.existsSync(base)?fs.readdirSync(base).sort():[]){const file=path.join(base,dir,'questions.csv');if(!fs.existsSync(file))continue;const digest=hash(fs.readFileSync(file).toString());const duplicateOf=seen.get(digest);exportFiles.push({file:path.relative(root,file),sha256:digest,duplicateOf:duplicateOf??null});if(duplicateOf)continue;seen.set(digest,path.relative(root,file));questions.push(...readRows(file));}
const counts=field=>Object.fromEntries([...new Set(questions.map(q=>field(q)))].sort().map(key=>[key,questions.filter(q=>field(q)===key).length]));
const rows=questions.map(row=>{const q={version:+row.version,sourceType:row.source_type,sourceQuestionId:null,prompt:row.prompt,options:row.options,correctAnswer:row.correct_answer,questionType:row.question_type,generationMetadata:row.generation_metadata};const facts=extract(q);return {historicalId:row.legacy_question_id,version:q.version,sourceType:q.sourceType,dataset:row.generation_metadata?.externalImport?.dataset,sourceIdentity:row.generation_metadata?.externalImport?.sourceIdentity,standardStudentChoice:isStandardStudentChoiceQuestion(q),keywordCandidate:/如图|下图|图中|shown|figure|diagram|graph|histogram|频数图/i.test(row.prompt),requiresFigureMarker:requiresFigure(q),verifiedRedraw:facts?{relation:facts.relation,phase:facts.phase}:null,originalImageBinding:Boolean(q.generationMetadata?.questionFigure),embeddedImage:/<img|!\[|\.(?:png|jpe?g|svg|webp)(?:[?#"\s]|$)/i.test(JSON.stringify(row))};});
const verified=rows.filter(r=>r.verifiedRedraw);const report={schemaVersion:'local-question-figure-coverage-v1',checkedAt:new Date().toISOString(),remoteDataAccess:false,
  scope:{currentDatabase:'loopback Docker moodlelike-postgres/moodlelike, READ ONLY',historicalExports:'local 2026-09-29 CSV snapshots, not current bank or online inventory',allQuestionsSemanticallyReviewed:false},
  currentBank:main,historical:{files:exportFiles,uniqueRows:rows.length,sourceTypes:counts(q=>q.source_type),subjects:counts(q=>q.subject),datasets:counts(q=>q.generation_metadata?.externalImport?.dataset),
    fourOptionEligible:rows.filter(r=>r.standardStudentChoice).length,nonstandardUnchanged:rows.filter(r=>!r.standardStudentChoice).length,originalImageBindings:rows.filter(r=>r.originalImageBinding).length,
    embeddedImageReferences:rows.filter(r=>r.embeddedImage).length,keywordCandidates:rows.filter(r=>r.keywordCandidate).length,
    verifiedRedraw:verified.length,verifiedRedrawStudentEligible:verified.filter(r=>r.standardStudentChoice).length,verifiedRows:verified,
    strictRequiredImageMarkers:rows.filter(r=>r.requiresFigureMarker).length,
    otherRowsNotSemanticallyClassified:rows.length-verified.length},
  conclusions:['Two strict public-condition rules are verified, not a full-bank illustration claim.','No reusable original question image is available in these snapshots; whole-paper file records do not establish question/version binding.','Keyword matches are candidates for manual review, not counts of missing or necessary figures.','Synthetic original/missing/mismatch fixtures and local reading pilots are excluded from external-bank coverage.','Ten-option sources retain their existing eligibility restrictions; no options or source provenance are rewritten.'],
  native:{version:'1.43.0',questionScopes:32,reviewOnlyScopes:1,upstreamArchiveSha256:'48ea6def723eec29957de583b6371492477f88f27365906627b0ff7224b32574'}};
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'.local/question-figures'),{recursive:true});fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(root,'.local/question-figures/external-row-classification.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify({currentSources:main.questionSources,historicalRows:rows.length,verified:verified.length,eligibleVerified:verified.filter(r=>r.standardStudentChoice).length,keywordCandidates:report.historical.keywordCandidates,nonstandard:report.historical.nonstandardUnchanged,originalImages:report.historical.originalImageBindings,requiresMarker:report.historical.strictRequiredImageMarkers}));
