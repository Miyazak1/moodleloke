'use strict';
const A=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {generate,oracle,validate}=require('../../question-engine/figures/reading-pilots.cjs');
const {approveOriginal,hash}=require('../../question-engine/figures/binding.cjs');
const {present}=require('../../question-engine/figures/presentation.cjs');
const {readRows}=require('../../scripts/question-figure-inventory.cjs');
exports.run=async function({app,prisma,userId,token,request,base,nativeQuestion}){
  const {CscaAdaptiveService}=require('../dist/backend/src/csca-special-practice/csca-adaptive.service.js');
  const {AdaptiveQuestionProviderService}=require('../dist/backend/src/csca-special-practice/adaptive-question-provider.service.js');
  const provider=app.get(AdaptiveQuestionProviderService),adaptive=app.get(CscaAdaptiveService);
  const directory=path.resolve(__dirname,'../../.local/question-figures');fs.mkdirSync(directory,{recursive:true});
  const metrics=[];
  let closeBrowser=async()=>{},capture=async()=>{};
  if(process.argv.includes('--browser')){
    const frontend=path.resolve(__dirname,'../../frontend'),{pathToFileURL}=require('node:url');const {createServer}=await import(pathToFileURL(require.resolve('vite',{paths:[frontend]})).href);const {chromium}=require('../../frontend/node_modules/@playwright/test');const cwd=process.cwd();process.chdir(frontend);
    const vite=await createServer({root:frontend,configFile:path.join(frontend,'vite.config.mjs'),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(base),'import.meta.env.VITE_AGENT_WEB_ENABLED':JSON.stringify('true')},server:{host:'127.0.0.1',port:5199,strictPort:true}});await vite.listen();const browser=await chromium.launch({headless:true});
    closeBrowser=async()=>{await browser.close();await vite.close();process.chdir(cwd);};
    capture=async(launch,key,phase,expected,accessToken=token)=>{
      for(const width of [320,390])for(const lang of ['zh-CN','en']){
        // Fixture session language is persisted, just as on a student-selected launch.
        await prisma.cscaAdaptiveSession.update({where:{id:launch.sessionId},data:{questionLanguage:lang==='en'?'en':'zh'}});
        const expectedResponse=await fetch(base+'/api/v1/csca-special-practice/adaptive/rounds/'+launch.roundId,{headers:{authorization:'Bearer '+accessToken}});A(expectedResponse.ok);const expectedDetail=await expectedResponse.json();
        const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
        await page.addInitScript(({token,lang})=>{localStorage.setItem('moodlelike.accessToken',token);localStorage.setItem('moodlelike.locale',lang);localStorage.setItem('cscalite.locale',lang);localStorage.setItem('moodlelike.localeSource','manual');localStorage.setItem('cscalite.localeSource','manual');},{token:accessToken,lang});
        const params=new URLSearchParams({agentRoundId:String(launch.roundId),agentArtifactId:launch.artifactId,agentContextId:launch.conversationId,agentTaskType:'free_practice',agentSubject:'math',agentView:phase==='review'?'report':'practice',mode:'free'});
        await page.goto('http://127.0.0.1:5199/agent?'+params);
        if(phase==='review')await page.locator('details').filter({has:page.locator('.agent-report-question-list')}).locator(':scope > summary').click({timeout:30000});else await page.locator('.special-question-card h1').waitFor({timeout:30000});
        const image=page.getByTestId('question-figure').first();
        if(expected){await image.waitFor();await image.scrollIntoViewIfNeeded();A((await image.locator('img').getAttribute('src')).endsWith(expectedDetail.questions[0].figure.data),'UI image must match the actual server question/version');const box=await image.boundingBox();A(box&&box.x>=-1&&box.x+box.width<=width+1,'figure overflows mobile viewport');A(await image.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0),'image decoding failed');
          await page.screenshot({path:path.join(directory,`${key}-${phase}-${lang}-${width}.png`),fullPage:true});
          await image.getByRole('button',{name:/放大图形|Enlarge figure/}).click();const dialog=page.getByRole('dialog',{name:/题目图形|Question figure/});await dialog.waitFor();const zoom=await dialog.locator('img').boundingBox();A(zoom&&zoom.width>=width-24,'mobile zoom must restore legible diagram size: '+JSON.stringify({width,zoom}));
          await page.screenshot({path:path.join(directory,`${key}-${phase}-${lang}-${width}-zoom.png`)});await dialog.getByRole('button',{name:/关闭|Close/}).click();metrics.push({key,phase,lang,width,roundId:launch.roundId,questionId:expectedDetail.questions[0].id,figureWidth:box.width,zoomWidth:zoom.width});
        }else A.equal(await page.getByTestId('question-figure').count(),0);
        A.deepEqual(errors,[]);await page.reload();if(phase==='question')await page.locator('.special-question-card h1').waitFor();await page.close();
      }
      await prisma.cscaAdaptiveSession.update({where:{id:launch.sessionId},data:{questionLanguage:'zh'}});
    };
  }
  try {
  const sourceFile=path.resolve(__dirname,'../../.local/external-oer-migrations/20260929T021800Z/questions.csv');
  const raw=readRows(sourceFile).find(q=>q.legacy_question_id==='1077');A(raw,'actual historical external question unavailable');
  const real={version:+raw.version,sourceType:raw.source_type,prompt:raw.prompt,options:raw.options,correctAnswer:raw.correct_answer,explanation:raw.explanation,questionType:raw.question_type,designedDifficulty:raw.designed_difficulty,syllabusVersion:raw.syllabus_version,knowledgeTags:raw.knowledge_tags,optionMetadata:raw.option_metadata,generationMetadata:{...raw.generation_metadata,localImportEvidence:{csvSha256:hash(fs.readFileSync(sourceFile).toString()),legacyId:raw.legacy_question_id,historicalExport:true}}};
  const simple=()=>({version:1,sourceType:'synthetic_figure_fixture',prompt:'根据下图，选择点 P 的标签。',options:['A','B','C','D'].map(id=>({id,text:id})),correctAnswer:'A',explanation:'合成验收题，仅检查图片管线。',generationMetadata:{figureRequirement:'required',figureOrigin:{synthetic:true,id:randomUUID()}}});
  const original=simple(),asset={mime:'image/svg+xml',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 204"><circle cx="100" cy="100" r="4" fill="#006b76"/><text x="110" y="100">P</text></svg>').toString('base64'),caption:'合成原图管线验收 / Synthetic original-image fixture'};
  original.generationMetadata.questionFigure=approveOriginal(original,asset,{role:'required',reviewer:'local-synthetic-test',sourceRef:'synthetic:fixture-not-a-real-external-image'},process.env.AUTH_SECRET);
  const missing=simple();A.equal(present(missing).state,'hold');const mismatched=structuredClone(original);mismatched.version=2;A.equal(present(mismatched).state,'hold');
  for(const kind of ['piecewise_range','frequency_mean'])for(let seed=0;seed<12;seed++){
    const q=generate(kind,seed);A(validate(q));const changed=structuredClone(q),p=changed.generationMetadata.readingPilot;
    let bad=p.svg.zh;if(kind==='piecewise_range')bad=bad.replace('fill="white"','fill="#006b76"');else bad=bad.replace(/class="frequency" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/,(_,x,y,w,h)=>`class="frequency" x="${x}" y="${+y-24}" width="${w}" height="${+h+24}"`);
    A.notEqual(oracle(bad,kind),p.oracleValue,'independent Oracle must detect changed plotted result');p.svg.zh=p.svg.en=bad;p.imageHash=hash(bad);A.equal(validate(changed),false,'Independent final-SVG Oracle must reject after digest is recomputed');
    if(kind==='frequency_mean'){const scale=structuredClone(q),proof=scale.generationMetadata.readingPilot;proof.svg.zh=proof.svg.en=proof.svg.zh.replace('>8</text>','>9</text>');proof.imageHash=hash(proof.svg.zh);A.equal(validate(scale),false,'altered axis scale');}
  }
  // Old, already stored native evidence must render without regenerating the question.
  A.equal(present(nativeQuestion,'question','zh').state,'ready');
  const old=structuredClone(nativeQuestion);old.prompt+=' changed';A.notEqual(present(old).state,'ready');
  const historical=(await prisma.cscaQuestion.findMany({where:{sourceType:'verified_math_engine',status:'approved',id:{lt:nativeQuestion.id}},orderBy:{id:'asc'}})).find(q=>present(q,'question','zh').state==='ready');
  A(historical,'a previously persisted native question must be covered');
  for(const [key,target] of [['native-old',historical],['native-new',nativeQuestion]]){
    const auth=await request('/api/v1/auth/register','POST',{email:'figure-'+randomUUID()+'@example.test',password:'Local-figure-test-password-123!'});
    const student=Number(auth.user.id),accessToken=auth.tokens.accessToken;
    await prisma.user.update({where:{id:student},data:{emailVerifiedAt:new Date()}});
    const others=await prisma.cscaQuestion.findMany({where:{topicId:target.topicId,id:{not:target.id}},select:{id:true}});
    await prisma.cscaQuestionExposure.createMany({data:others.map(q=>({userId:student,questionId:q.id,source:'adaptive_round:csca_question'})),skipDuplicates:true});
    const call=async(route,method='GET',body)=>{const r=await fetch(base+route,{method,headers:{'content-type':'application/json',authorization:'Bearer '+accessToken},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();A(r.ok,JSON.stringify(value));return value;};
    const launch=await call('/api/v1/agent/free-practice/start','POST',{clientRequestId:randomUUID(),subject:'math',practiceMode:'single_topic',focusTopicId:target.topicId,difficulty:/难|hard/.test(target.designedDifficulty)?'hard':/中|medium/.test(target.designedDifficulty)?'medium':'basic',questionCount:1,questionLanguage:'zh'});
    const route='/api/v1/csca-special-practice/adaptive/rounds/'+launch.roundId;A.equal((await call(route)).questions[0].id,target.id,'existing native question is reused, not regenerated');
    await capture(launch,key,'question',true,accessToken);
    await call(route+'/check','POST',{questionId:target.id,selected:target.correctAnswer});await call(route,'PATCH',{answers:{[target.id]:target.correctAnswer},timeSpent:{[target.id]:20}});A.equal((await call(route+'/submit','POST',{})).items[0].isCorrect,true);
    await capture(launch,key,'review',true,accessToken);
  }
  const cases=[['real-historical-external',real],['synthetic-original',original],['piecewise_range',generate('piecewise_range',2)],['frequency_mean',generate('frequency_mean',1)]];
  const launches=[],samples=[];
  for(const [key,q] of cases){
    const topic=await prisma.cscaExamTopic.create({data:{code:'FIG-'+key+'-'+randomUUID().slice(0,8),subject:'math',title:key,syllabusVersion:q.syllabusVersion??'2025',status:'published'}});
    const stored=await prisma.cscaQuestion.create({data:{subject:'math',topicId:topic.id,sourceType:q.sourceType,version:q.version,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,explanation:q.explanation,
      designedDifficulty:q.designedDifficulty??'基础',questionType:q.questionType??'single_choice',syllabusVersion:q.syllabusVersion??'2025',status:'approved',knowledgeTags:q.knowledgeTags??[],optionMetadata:q.optionMetadata??undefined,generationMetadata:q.generationMetadata,
      reviewMetadata:{localAcceptanceOnly:true,material:key.startsWith('real-')?'actual_historical_csv':'synthetic_or_experimental_not_formal_engine'}}});
    const launch=await request('/api/v1/agent/free-practice/start','POST',{clientRequestId:randomUUID(),subject:'math',practiceMode:'single_topic',focusTopicId:topic.id,questionCount:1,questionLanguage:'zh'});
    const route='/api/v1/csca-special-practice/adaptive/rounds/'+launch.roundId;
    const detail=await request(route+'?phase=review');A.equal(detail.questions[0].id,stored.id);A.equal(detail.questions[0].correctAnswer,undefined);A.equal(detail.questions[0].explanation,undefined);
    A.doesNotMatch(JSON.stringify(detail.questions),/"(?:questionArtifact|sourceVerification|sourceCandidate|oracleValue|answerBinding|signature)"/);
    if(key==='real-historical-external')A.equal(detail.questions[0].figure,null,'slope line only after submission');else A.equal(detail.questions[0].figure.phase,'question');
    const reportBefore=await fetch(base+route+'/report',{headers:{authorization:'Bearer '+token}});A.equal(reportBefore.status,400,'report must not expose review/answers before submission');
    const english=await request(route+'?language=en');if(key!=='real-historical-external')A(english.questions[0].figure);A.deepEqual((await request(route)).questions[0].figure,detail.questions[0].figure,'refresh binding');
    samples.push({key,phase:'question',prompt:detail.questions[0].prompt,options:detail.questions[0].options,figure:detail.questions[0].figure});
    await capture(launch,key,'question',key!=='real-historical-external');
    await request(route+'/check','POST',{questionId:stored.id,selected:stored.correctAnswer});if(key==='real-historical-external')A.equal((await request(route)).questions[0].figure,null);
    await request(route,'PATCH',{answers:{[stored.id]:stored.correctAnswer},timeSpent:{[stored.id]:20}});const report=await request(route+'/submit','POST',{});A.equal(report.items[0].isCorrect,true);A.equal(report.items[0].figure.phase,'review');
    samples.push({key,phase:'review',prompt:report.items[0].prompt,options:report.items[0].options,figure:report.items[0].figure});
    await capture(launch,key,'review',true);
    launches.push({key,topic,stored,roundId:launch.roundId,figure:detail.questions[0].figure});
  }
  // Missing and mismatched images are synthetic counterexamples, not invented corpus cases.
  for(const [name,q] of [['missing',missing],['mismatch',mismatched]]){
    const topic=await prisma.cscaExamTopic.create({data:{code:'FIG-HOLD-'+randomUUID().slice(0,8),subject:'math',title:name,syllabusVersion:'2025',status:'published'}});
    const stored=await prisma.cscaQuestion.create({data:{subject:'math',topicId:topic.id,sourceType:q.sourceType,version:q.version,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,explanation:q.explanation,designedDifficulty:'基础',questionType:'single_choice',syllabusVersion:'2025',status:'approved',knowledgeTags:[],generationMetadata:q.generationMetadata}});
    A.equal((await provider.pickQuestions(userId,[{topicId:topic.id,code:topic.code,title:name,module:null,targetDifficulty:'基础',reason:'figure_hold_test'}],1)).length,0);
    A.equal(await prisma.cscaAdaptiveInventoryEvent.count({where:{questionId:stored.id,eventType:'required_figure_unavailable'}}),1,'hold reason is durably recorded');
    A.equal((await prisma.cscaQuestion.findUnique({where:{id:stored.id}})).status,'approved','no destructive quarantine rewrite');
  }
  fs.writeFileSync(path.join(directory,'public-samples.json'),JSON.stringify(samples,null,2));
  fs.writeFileSync(path.join(directory,'live-cases.json'),JSON.stringify({nativeQuestionId:nativeQuestion.id,cases:launches.map(l=>({key:l.key,questionId:l.stored.id,roundId:l.roundId,sourceType:l.stored.sourceType})),realOriginalImagesAvailable:0,syntheticCases:['original','missing','mismatch'],providerCalls:0,costUsd:0},null,2));
  if(process.argv.includes('--browser')) fs.writeFileSync(path.join(directory,'mobile-layout.json'),JSON.stringify(metrics,null,2));
  console.log('QUESTION_FIGURES_LIVE_OK: actual historical external + old/new native + signed synthetic originals + required-image holds + two final-SVG Oracle pilots.');
  } finally { await closeBrowser(); }
};
