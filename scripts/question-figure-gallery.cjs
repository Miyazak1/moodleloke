'use strict';
// Whitelisted public display only. No answer keys, explanations or internal evidence.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('../backend/node_modules/@prisma/client');
const {present}=require('../question-engine/figures/presentation.cjs');
const {renderExternal}=require('../question-engine/figures/external.cjs');
const {readRows}=require('./question-figure-inventory.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'artifacts/question-figures');
const url=new URL(process.env.MATH_ENGINE_ACCEPTANCE_DATABASE_URL??'http://invalid');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/moodlelike_math_engine_acceptance')throw Error('Dedicated loopback acceptance database required');
const p=new PrismaClient({datasources:{db:{url:url.href}}});
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function main(){
  const samples=JSON.parse(fs.readFileSync(path.join(root,'.local/question-figures/public-samples.json'),'utf8'));
  const metrics=JSON.parse(fs.readFileSync(path.join(root,'.local/question-figures/mobile-layout.json'),'utf8'));
  const targets=[...new Map(metrics.filter(m=>m.key.startsWith('native-')).map(m=>[m.key,m.questionId]))];
  const rows=await p.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');return tx.cscaQuestion.findMany({where:{id:{in:targets.map(t=>t[1])}}});});
  for(const [key,id] of targets){const q=rows.find(r=>r.id===id);if(!q)throw Error('native sample not found');for(const lang of ['zh','en'])for(const phase of ['question','review']){
    const figure=present(q,phase,lang).display;if(!figure)throw Error('native sample figure not verified');const localized=q.generationMetadata.localizations?.[lang];samples.push({key:key+'-'+lang,phase,prompt:localized?.prompt??q.prompt,options:localized?.options??q.options,figure});
  }}
  // This actual ten-option record is reviewed as a figure preview, not republished.
  const raw=readRows(path.join(root,'.local/external-oer-migrations/20260929T021800Z/questions.csv')).find(q=>q.legacy_question_id==='3882');
  const candidate={version:+raw.version,sourceType:raw.source_type,prompt:raw.prompt,options:raw.options,generationMetadata:raw.generation_metadata};
  samples.push({key:'real-historical-ten-option-preview-only',phase:'question',prompt:raw.prompt,options:[],figure:renderExternal(candidate,'question','zh')?.display});
  const {generate}=require('../question-engine/figures/reading-pilots.cjs');process.env.MOODLELIKE_READING_PILOTS_ENABLED='true';
  for(const [kind,seed] of [['piecewise_range',2],['frequency_mean',1]]){const q=generate(kind,seed);samples.push({key:kind+'-en',phase:'question',prompt:q.generationMetadata.localizations.en.prompt,options:q.options,figure:present(q,'question','en').display});}
  fs.mkdirSync(path.join(directory,'figures'),{recursive:true});fs.mkdirSync(path.join(directory,'mobile'),{recursive:true});
  const articles=[];let index=0;
  for(const sample of samples){
    const material=sample.key.startsWith('synthetic')?'合成原图管线反例（非真实题源原图）':sample.key.startsWith('native-')?'真实已入库 Math 1.43 题':sample.key.startsWith('real-')?'实际本地历史外部题':'本项目读图试点（非正式引擎）';
    let image='';if(sample.figure){const suffix=sample.figure.mime==='image/svg+xml'?'svg':sample.figure.mime==='image/png'?'png':'jpg';const name=String(++index).padStart(2,'0')+'-'+sample.key+'-'+sample.phase+'.'+suffix;fs.writeFileSync(path.join(directory,'figures',name),Buffer.from(sample.figure.data,'base64'));image=`<a href="figures/${name}"><img src="figures/${name}" alt="${esc(sample.figure.alt)}"></a><p class="caption">${esc(sample.figure.caption)}</p>`;}
    articles.push(`<article><p class="material">${esc(material)} · ${sample.phase==='question'?'读题阶段':'交卷后阶段'}</p><h2>${esc(sample.key)}</h2>${sample.key.includes('ten-option')?'<p class="note">10 个选项，不符合现有学生四选一规则；仅复核题图，不曾发布给学生。</p>':''}<p>${esc(sample.prompt)}</p>${image||'<p class="note">本阶段不显示图。斜率连线只在交卷后提供。</p>'}<ol type="A">${(sample.options??[]).map(o=>`<li>${esc(o.text)}</li>`).join('')}</ol></article>`);
  }
  for(const [source,target] of [['piecewise_range-question-zh-CN-320-zoom.png','piecewise-range-zh-320.png'],['frequency_mean-question-en-320-zoom.png','frequency-mean-en-320.png'],['native-old-question-zh-CN-320-zoom.png','native-old-zh-320.png']])fs.copyFileSync(path.join(root,'.local/question-figures',source),path.join(directory,'mobile',target));
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生题图本地样张</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#173742;background:#f3f7f8;margin:0;padding:20px}main{max-width:1180px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{background:white;border:1px solid #dae6e9;border-radius:12px;padding:20px;min-width:0;overflow-wrap:anywhere}h2{font-size:17px}.material{font-size:13px;color:#226d74}img{display:block;max-width:100%;width:400px;height:auto;margin:auto}.caption,.note{font-size:14px;color:#46616c}li{padding:4px}a{color:#006b76}</style><main><h1>学生题图本地样张</h1><p>这是离线开发样张，不连接服务器，不含标准答案、解析或内部工件。点击图可打开完整 SVG。阶段标签用于复核，不代表客户端能改变实际题目的展示时机。</p><p>实际可访问外部导出没有原图；合成原图单独标注。两个读图题仍为本地试点，未并入数学 1.43 冻结范围。</p><div class="grid">${articles.join('')}</div></main></html>`;
  fs.writeFileSync(path.join(directory,'samples.html'),html);
  console.log(JSON.stringify({samples:samples.length,publicFigureFiles:index,answerKeysExported:false,output:'artifacts/question-figures/samples.html'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
