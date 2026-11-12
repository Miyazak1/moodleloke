'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const B=require('./binding.cjs'),P=require('./reading-pilots.cjs'),E=require('./external.cjs'),{present}=require('./presentation.cjs');
process.env.MOODLELIKE_READING_PILOTS_ENABLED='true';
const question=()=>({version:1,sourceType:'manual_public_source',prompt:'What is the slope of the line that passes through the points (5, 4) and (–2, 3)?',options:['A','B','C','D'].map(id=>({id,text:id})),generationMetadata:{figureOrigin:{synthetic:true}}});
test('answers are independently recovered from final plotted geometry and printed ticks',()=>{
  A.equal(P.oracle(P.generate('piecewise_range',0).generationMetadata.readingPilot.svg.zh,'piecewise_range'),'[-2,1) ∪ {2} ∪ (3,5]');
  for(const [seed,answer] of [[0,'11/3'],[1,'10/3'],[2,'3']])A.equal(P.oracle(P.generate('frequency_mean',seed).generationMetadata.readingPilot.svg.zh,'frequency_mean'),answer);
  for(const kind of ['piecewise_range','frequency_mean'])for(let seed=0;seed<12;seed++)A(P.validate(P.generate(kind,seed)));
});
test('endpoint, tick and bar edits fail even if an attacker recomputes the ordinary image digest',()=>{
  for(const kind of ['piecewise_range','frequency_mean']){const q=P.generate(kind,0),p=q.generationMetadata.readingPilot;const bad=kind==='piecewise_range'?p.svg.zh.replace('fill="white"','fill="#006b76"'):p.svg.zh.replace(/class="frequency" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/,(_,x,y,w,h)=>`class="frequency" x="${x}" y="${+y-24}" width="${w}" height="${+h+24}"`);A.notEqual(P.oracle(bad,kind),p.oracleValue);p.svg.zh=p.svg.en=bad;p.imageHash=B.hash(bad);A.equal(P.validate(q),false);}
  const q=P.generate('frequency_mean',2),p=q.generationMetadata.readingPilot;let i=0;p.svg.zh=p.svg.en=p.svg.zh.replace(/class="frequency" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g,(all,x,y,w,h)=>i++===1?`class="frequency" x="${x}" y="${+y-24}" width="${w}" height="${+h+24}"`:all);p.imageHash=B.hash(p.svg.zh);A.equal(P.oracle(p.svg.zh,p.kind),p.oracleValue);A.equal(P.validate(q),false,'same answer does not authorize a changed figure/version');
  const scale=P.generate('frequency_mean',0),s=scale.generationMetadata.readingPilot;s.svg.zh=s.svg.en=s.svg.zh.replace('>8</text>','>9</text>');s.imageHash=B.hash(s.svg.zh);A.throws(()=>P.oracle(s.svg.zh,s.kind),/tick_scale/);A.equal(P.validate(scale),false);
});
test('external evidence supports reviewed source types without impersonating Math Lab, and binds translations and versions',()=>{
  const q=question(),key='local-test-key-only';q.generationMetadata.externalFigureProof=E.approveExternalFacts(q,{sourceRef:'synthetic-test',reviewer:'test'},key);A(E.extract(q,key));const reordered=JSON.parse(JSON.stringify(q));reordered.generationMetadata.externalFigureProof.facts=Object.fromEntries(Object.entries(reordered.generationMetadata.externalFigureProof.facts).reverse());A(E.extract(reordered,key));
  q.version=2;A.equal(E.extract(q,key),null);q.version=1;q.prompt=q.prompt.replace('(5, 4)','(6, 4)');A.equal(E.extract(q,key),null);
  const translated=question();translated.generationMetadata.localizations={en:{prompt:translated.prompt.replace('(5, 4)','(6, 4)')}};A.throws(()=>E.approveExternalFacts(translated,{sourceRef:'test',reviewer:'test'},key),/REVIEW_REQUIRED/);
  const noAnswer=question();Object.defineProperty(noAnswer,'correctAnswer',{get(){throw Error('must not read answer to derive figure');}});A(E.parse(noAnswer));
});
test('original assets require a trusted review and bind bytes, phase and question version',async()=>{
  const q=question(),key='local-test-key-only',asset={mime:'image/svg+xml',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 204"><circle cx="50" cy="50" r="4"/></svg>').toString('base64'),caption:'Synthetic codec test'};
  q.generationMetadata.questionFigure=B.approveOriginal(q,asset,{role:'required',reviewer:'test',sourceRef:'synthetic:original'},key);A(B.original({...q,localizations:{}},'question',key).display);q.version++;A(B.original(q,'question',key).blocked);q.version--;
  const changed=structuredClone(q);changed.generationMetadata.questionFigure.asset.caption+=' changed';A(B.original(changed,'question',key).blocked);
  for(const svg of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>','<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/x"/></svg>'])A.equal(B.svgSafe(svg),false);
  const {createCanvas}=require('../../backend/node_modules/@napi-rs/canvas');const png={mime:'image/png',data:createCanvas(2,2).toBuffer('image/png').toString('base64')};const bitmap=await B.approveOriginalBitmap(q,png,{reviewer:'test',sourceRef:'synthetic:bitmap'},key);A(B.original({...q,generationMetadata:{...q.generationMetadata,questionFigure:bitmap}},'question',key).display);await A.rejects(B.approveOriginalBitmap(q,{...png,data:Buffer.from('not an image').toString('base64')},{reviewer:'test',sourceRef:'synthetic'},key));
});
test('required-image holds and experimental pilots cannot be waived by display parameters',()=>{
  const q={...question(),generationMetadata:{figureRequirement:'required'}};A.equal(present(q).state,'hold');A.throws(()=>present(q,'answer','en'),/INVALID_FIGURE_PHASE/);const p=P.generate('piecewise_range',0);p.version=2;A.equal(present(p).state,'hold');process.env.MOODLELIKE_READING_PILOTS_ENABLED='false';A.equal(present(P.generate('frequency_mean')).state,'hold');process.env.MOODLELIKE_READING_PILOTS_ENABLED='true';
});
