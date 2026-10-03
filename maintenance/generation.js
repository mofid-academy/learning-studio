function KC(sources, count) {
 const expanded=sources.filter(s=>s.text.trim()).flatMap(s=>{
  const chunks=[];let rest=s.text;
  while(rest.length>9000){let end=rest.lastIndexOf(' ',9000);if(end<7000)end=9000;chunks.push({...s,text:rest.slice(0,end)});rest=rest.slice(end);}
  if(rest.trim())chunks.push({...s,text:rest});return chunks;
 });
 const total=expanded.reduce((n,s)=>n+s.text.length,0);
 count=Math.max(1,Math.min(count||Math.ceil(total/6500),Math.max(1,Math.floor(total/2200)),24));
 const target=Math.max(2200,Math.ceil(total/count)),groups=[];let group=[],size=0;
 for(const source of expanded){if(group.length&&(size+source.text.length>22000||(size>=target&&groups.length<count-1))){groups.push(group);group=[];size=0;}group.push(source);size+=source.text.length;}
 if(group.length)groups.push(group);
 for(let i=groups.length-1;i>=0;i--){const size=groups[i].reduce((n,s)=>n+s.text.length,0);if(size>=2200||groups.length===1)continue;let j=i>0?i-1:i+1;if(size+groups[j].reduce((n,s)=>n+s.text.length,0)<=22000){const start=Math.min(i,j);groups.splice(start,2,[...groups[start],...groups[start+1]]);}}
 return groups;
}
function mofidUnique(items, text){const seen=new Set();return items.filter(x=>{const key=String(text(x)).normalize('NFKC').replace(/[\s\u200c\p{P}]+/gu,'').toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});}
function mofidFacts(group){return mofidUnique(group.flatMap(s=>HC(s.text).filter(t=>t.trim().length>=28&&t.length<=950).map(t=>({t:t.trim(),source:s.id}))),x=>x.t);}
function mofidNotCloze(q){return !/جای[\s‌-]*خالی|ــــ|_{2,}|\.{3,}|…/u.test(q.question);}
function mofidGroundedQuestion(q,group){
 if(!mofidNotCloze(q))return false;
 const cited=group.filter(s=>q.sourceIds.includes(s.id)).map(s=>s.text).join(' ');
 const normalize=s=>s.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک');
 const tokens=s=>[...new Set(normalize(s).match(/[\p{L}\p{N}‌]{3,}/gu)||[])];
 const evidence=tokens(q.explanation);if(!evidence.length)return false;
 const sourceWords=new Set(tokens(cited));return evidence.filter(w=>sourceWords.has(w)).length/evidence.length>=.45;
}
function qC(group,index,settings,all){
 const id='m'+(index+1),first=group[0],title=GC(first.heading||first.text.split('\n').find(x=>x.length>4&&x.length<120)||first.label,90);
 const facts=mofidFacts(group),questions=[];
 // The fallback is a source-reading question. Every option is an intact
 // statement from this chapter; only the correct statement contains the topic.
 // No vocabulary from other chapters, invented names or fabricated claims.
 for(const fact of facts){
  if(questions.length>=Math.max(1,settings.questions))break;
  const keys=[...new Set(WC(fact.t))].filter(w=>!['میتواند','می‌تواند','کرده','باشد','درباره','همچنین','استفاده','باید','برای','میشود','می‌شود','گردد','آنها','اینکه'].includes(w)).sort((a,b)=>b.length-a.length);
  let key='',others=[];
  for(const candidate of keys){const rest=facts.filter(f=>f.t!==fact.t&&!f.t.includes(candidate));if(rest.length>=3){key=candidate;others=rest;break;}}
  if(!key)continue;
  const idx=questions.length,answer=(index+idx)%4,options=others.slice(0,3).map(f=>f.t);options.splice(answer,0,fact.t);
  const forms=['کدام عبارت در جزوه دربارهٔ «'+key+'» آمده است؟','طبق متن این فصل، کدام توضیح به «'+key+'» مربوط است؟','کدام گزینه، توضیح جزوه دربارهٔ «'+key+'» را بیان می‌کند؟'];
  questions.push({id:id+'-q'+idx,question:forms[idx%forms.length],options,answer,explanation:fact.t,sourceIds:[...new Set([fact.source,...others.slice(0,3).map(f=>f.source)])]});
 }
 const flashcards=facts.slice(0,settings.cards).map((f,j)=>({id:id+'-f'+j,front:'دربارهٔ «'+[...new Set(WC(f.t))].sort((a,b)=>b.length-a.length).slice(0,2).join('» و «')+'» چه نکته‌ای در جزوه آمده است؟',back:f.t,sourceIds:[f.source]}));
 return{id,title,summary:facts[0]?.t||first.text.slice(0,500),objectives:['توضیح مفاهیم اصلی '+title],sections:group.map(s=>({title:s.heading||s.label,body:s.text,sourceIds:[s.id]})),keyPoints:facts.slice(0,8).map(f=>f.t),questions,flashcards};
}
function JC(title,modules){
 const slides=[{title,bullets:modules.slice(0,6).map(m=>m.title),notes:'راهنمای ارائه؛ توضیحات تفصیلی هر بخش در یادداشت اسلاید آمده است.',sourceIds:[]}];
 const budget=Math.max(2,Math.floor(240/Math.max(1,modules.length))-1);
 for(const m of modules){const refs=[...new Set(m.sections.flatMap(s=>s.sourceIds))];
  const facts=mofidUnique(m.sections.flatMap(s=>HC(s.body).filter(t=>t.length>30).map(t=>({t,sourceIds:s.sourceIds,heading:s.title}))),x=>x.t);
  const pages=[];let current=[],length=0;
  for(const fact of facts){if(current.length&&(current.length>=3||length+fact.t.length>580)){pages.push(current);current=[];length=0;}current.push(fact);length+=fact.t.length;}if(current.length)pages.push(current);
  if(!pages.length)pages.push([{t:m.summary,sourceIds:refs,heading:m.title}]);
  const selected=pages.length<=budget?pages:Array.from({length:budget},(_,i)=>pages[Math.floor(i*(pages.length-1)/(budget-1))]);
  selected.forEach((page,i)=>slides.push({title:GC(m.title+(selected.length>1?' · '+(i+1):''),480),bullets:page.map(f=>GC(f.t,430)),notes:page.map(f=>f.t).join('\n\n').slice(0,19000),sourceIds:[...new Set(page.flatMap(f=>f.sourceIds))]}));
  if(m.keyPoints.length)slides.push({title:GC('مرور فصل: '+m.title,480),bullets:m.keyPoints.slice(0,3).map(t=>GC(t,350)),notes:m.summary.slice(0,19000),sourceIds:refs});
 }
 return slides.slice(0,250);
}
function mofidReadModule(data){
 for(let depth=0;depth<8;depth++){
  if(typeof data==='string'){data=JSON.parse(data.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));continue;}
  if(Array.isArray(data)){data=data[0];continue;}
  if(!data||typeof data!=='object')return{};
  if(data.module!=null){data=data.module;continue;}
  if(data.sections||data.questions||data.quiz||data.flashcards)return data;
  const key=['data','result','output','json','text','response','body'].find(k=>data[k]!=null);
  if(!key)return data;data=data[key];
 }
 return{};
}
function mofidNormalizeModule(raw,index,group=[]){
 raw=raw&&typeof raw==='object'?raw:{};
 const array=x=>Array.isArray(x)?x:[];
 const text=x=>typeof x==='string'?x:Array.isArray(x)?x.map(text).filter(Boolean).join('\n'):x&&typeof x==='object'?text(x.text??x.content):'';
 const list=(...values)=>values.map(array).find(a=>a.length)||[];
 const clean=s=>String(s).normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ');
 const words=s=>[...new Set(clean(s).match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(w=>!['برای','است','باشد','شده','شود','این','آن','طبق','متن','جزوه','مورد','گزینه','پاسخ','دارد','کرده','باید','براساس','اساس'].includes(w));
 const allowed=new Set(group.map(s=>s.id));
 function references(item,evidence){
  const given=item.sourceIds??item.source_ids??item.sourceId??item.source_id??item.references;
  const supplied=(Array.isArray(given)?given:typeof given==='string'?[given]:[]).map(x=>typeof x==='string'?x:x?.id).filter(x=>typeof x==='string');
  const valid=[...new Set(supplied.filter(id=>!group.length||allowed.has(id)))].slice(0,600);
  if(valid.length)return valid;
  const terms=words(evidence);if(!terms.length)return[];
  const ranked=group.map(s=>{const tokens=new Set(words(s.text));return{id:s.id,score:terms.filter(t=>tokens.has(t)).length/terms.length};}).sort((a,b)=>b.score-a.score);
  if(!ranked.length||ranked[0].score<.6)return[];
  return [...new Set(ranked.filter(s=>s.score>=Math.max(.6,ranked[0].score-.03)).slice(0,6).map(s=>s.id))];
 }
 function accepted(schema,items){return items.flatMap(item=>{const result=schema.safeParse(item);return result.success?[result.data]:[];});}
 const rawSections=array(raw.sections);
 let sections=accepted(wg.shape.sections.element,rawSections.map(s=>{s=s&&typeof s==='object'?s:{};const body=text(s.body)||text(s.content)||text(s.text);return{title:(text(s.title)||text(s.heading)||'شرح فصل').slice(0,500),body:body.slice(0,100000),sourceIds:references(s,body)};})).filter(s=>s.body.trim());
 if(!sections.length)sections=group.filter(s=>s.text.trim()).map(s=>({title:s.heading||s.label,body:s.text,sourceIds:[s.id]}));
 sections=sections.slice(0,600);
 const rawQuestions=list(raw.questions,raw.quiz,raw.quiz?.questions,raw.assessment?.questions);
 const questions=accepted(wg.shape.questions.element,rawQuestions.map((q,j)=>{
  q=q&&typeof q==='object'?q:{};
  const options=list(q.options,q.choices).map(o=>text(o)||text(o?.label)||text(o?.value));
  const value=q.answer??q.correct_answer??q.correctAnswer??q.correct_answer_index??q.answerIndex;
  const str=typeof value==='string'?value.trim().replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))):'';
  const letter=['A','B','C','D'].indexOf(str.toUpperCase()),persian=['الف','ب','ج','د'].indexOf(str);
  const numeric=typeof value==='number'?value:/^[0-3]$/.test(str)?Number(str):undefined;
  const answer=numeric??(options.indexOf(value)>=0?options.indexOf(value):letter>=0?letter:persian);
  const question=text(q.question)||text(q.prompt)||text(q.text);
  const explanation=text(q.explanation)||text(q.rationale)||text(q.reason);
  const evidence=explanation||question+' '+(options[answer]||'');
  let sourceIds=references(q,evidence);if(!sourceIds.length)sourceIds=references(q,question+' '+(options[answer]||''));
  const cited=group.find(s=>sourceIds.includes(s.id));
  const support=explanation|| (cited?HC(cited.text).find(s=>options[answer]&&clean(s).includes(clean(options[answer])))||'':'');
  return{id:'q'+j,question,options,answer,explanation:support,sourceIds};
 })).slice(0,40);
 const flashcards=accepted(wg.shape.flashcards.element,list(raw.flashcards,raw.flash_cards,raw.cards).map((f,j)=>{f=f&&typeof f==='object'?f:{};const front=text(f.front)||text(f.question),back=text(f.back)||text(f.answer);return{id:'f'+j,front,back,sourceIds:references(f,back||front)};})).slice(0,80);
 const objectives=list(raw.objectives,raw.learning_objectives,raw.learningObjectives).map(text).filter(Boolean).slice(0,12);
 const points=list(raw.keyPoints,raw.key_points,rawSections.flatMap(s=>array(s?.key_points))).map(text).filter(Boolean).slice(0,12);
 return{id:'m'+(index+1),title:(text(raw.title)||group[0]?.heading||group[0]?.label||'فصل '+(index+1)).slice(0,500),summary:(text(raw.summary)||sections[0]?.body||'').slice(0,6000),objectives,sections,keyPoints:points,questions,flashcards};
}
async function YC(sources,sourceName,settings,onProgress,signal,auth){
 let groups=KC(sources,settings.modules),modules=[];
 const credentials=auth?.username&&auth.password?btoa(String.fromCharCode(...new TextEncoder().encode(auth.username+':'+auth.password))):'';
 async function request(group,index,task,avoid=[]){
  const directions={quiz:'آزمون مستقل طراحی کن: سؤال‌های مفهومی، مقایسه‌ای، علت و معلول، ترتیب مراحل و کاربردی متنوع. سؤال جای خالی نساز. هر سؤال یک مفهوم آموزشی همین فصل را بسنجد. چهار گزینه هم‌موضوع و باورپذیر، فقط یک پاسخ درست و توضیح مستند بده. نام اشخاص و کلمات نامرتبط را به‌عنوان گزینه استفاده نکن. سؤال‌ها و گزینه‌ها را از فصل‌های دیگر برندار.',quizRepair:'بازسازی آزمون: خروجی پیشین سؤال معتبر نداشت یا جای خالی بود. دست‌کم یک سؤال مفهومی چهارگزینه‌ای روشن و مستند از شرط، مراحل یا مفهوم اصلی همین فصل بساز. سؤال جای خالی، متن حذف‌کلمه‌ای یا گزینه‌های تک‌واژه‌ای بی‌ربط ممنوع است. تعداد کم با کیفیت بالا بهتر است. همه گزینه‌ها به موضوع همان سؤال مربوط باشند؛ پاسخ و توضیح فقط از همین منابع باشد.',cards:'فلش‌کارت مستقل برای بازیابی فعال طراحی کن: تعریف، رابطه، علت و مقایسه. صورت سؤال آزمون را کپی نکن. کارت جای خالی و کارت چندگزینه‌ای نساز.',presentation:'محتوای یک ارائه آموزشی مستقل بساز. sections شامل توضیح منسجم مفاهیم، روابط و مثال‌های موجود در منبع باشد؛ keyPoints جمع‌بندی باشد. صرفاً سؤال یا فلش‌کارت را به اسلاید تبدیل نکن.'};
  const instruction=directions[task]+' فقط به منابع تکیه کن؛ واقعیت یا مثال خارج از جزوه نساز. تعداد خروجی متناسب با محتوای واقعی باشد. '+(avoid.length?'این صورت سؤال‌ها را تکرار نکن: '+avoid.slice(0,20).join(' | '):'');
  const response=await fetch('https://miladmirsheriseyed.app.n8n.cloud/webhook/mofid-learning-module-gemini',{method:'POST',headers:{'Content-Type':'application/json',...(credentials?{Authorization:'Basic '+credentials}:{})},body:JSON.stringify({sources:group.map(({images,...s})=>s),title:(settings.title||'دوره آموزشی')+'\nراهنمای تولید: '+instruction,instructions:instruction,task,moduleNumber:index+1,questions:task==='quizRepair'?1:Math.max(1,settings.questions),cards:Math.max(1,settings.cards)}),signal,redirect:'error'});
  let data;try{data=await response.json();}catch{throw Error('پاسخ وبهوک JSON معتبر نیست. خروجی نود آخر n8n را بررسی کنید.');}
  if(!response.ok)throw Error(data.error||'تولید محتوا انجام نشد (HTTP '+response.status+').');
  let raw;try{raw=mofidReadModule(data);}catch{throw Error('پاسخ مدل JSON کامل نیست؛ خروجی نود آخر n8n را بررسی کنید.');}
  const m=wg.parse(mofidNormalizeModule(raw,index,group));
  const refs=new Set(group.map(s=>s.id));for(const x of [...m.sections,...m.questions,...m.flashcards])if(x.sourceIds.some(id=>!refs.has(id)))throw Error('خروجی هوش مصنوعی ارجاع نامعتبر دارد.');
  return m;
 }
 const usedQuestions=new Set(),usedCards=new Set();
 for(let i=0;i<groups.length;i++){
  if(signal?.aborted)throw new DOMException('لغو شد','AbortError');let m;
  onProgress(Math.round(i/groups.length*88),'ساخت آزمون فصل '+(i+1)+' از '+groups.length+'…');
  if(settings.mode==='ai'){
   m=await request(groups[i],i,'quiz',[...usedQuestions]);m.questions=mofidUnique(m.questions,q=>q.question).filter(q=>mofidGroundedQuestion(q,groups[i])&&!usedQuestions.has(q.question.trim()));
   if(!m.questions.length){onProgress(Math.round(i/groups.length*88),'بازسازی سؤال مفهومی فصل '+(i+1)+'…');const repair=await request(groups[i],i,'quizRepair',[...usedQuestions]);m.questions=mofidUnique(repair.questions,q=>q.question).filter(q=>mofidGroundedQuestion(q,groups[i])&&!usedQuestions.has(q.question.trim()));}
   if(!m.questions.length&&groups.length>1){const j=i+1<groups.length?i+1:i-1;const start=Math.min(i,j),merged=[...groups[start],...groups[start+1]];if(merged.reduce((n,s)=>n+s.text.length,0)<=22000){groups.splice(start,2,merged);if(j<i){modules.pop();usedQuestions.clear();usedCards.clear();for(const old of modules){old.questions.forEach(q=>usedQuestions.add(q.question.trim()));old.flashcards.forEach(f=>usedCards.add(f.front.trim()));}}i=start-1;continue;}}
   if(!m.questions.length)m.questions=qC(groups[i],i,settings,sources).questions;
   if(!m.questions.length)throw Error('مدل پس از تلاش مجدد سؤال مفهومی مستند نداد؛ برای بررسی، خروجی مرحلهٔ آزمون n8n و متن این فصل را ارسال کنید.');
   onProgress(Math.round((i+.33)/groups.length*88),'ساخت فلش‌کارت‌های مستقل فصل '+(i+1)+'…');
   const cards=await request(groups[i],i,'cards',m.questions.map(q=>q.question));const prompts=new Set(m.questions.map(q=>q.question.replace(/[\s\p{P}]+/gu,'')));
   m.flashcards=mofidUnique(cards.flashcards,f=>f.front).filter(f=>!prompts.has(f.front.replace(/[\s\p{P}]+/gu,''))&&!usedCards.has(f.front.trim()));
   if(!m.flashcards.length)m.flashcards=qC(groups[i],i,settings,sources).flashcards;
   onProgress(Math.round((i+.66)/groups.length*88),'ساخت محتوای ارائه فصل '+(i+1)+'…');
   const presentation=await request(groups[i],i,'presentation');m.sections=presentation.sections;m.summary=presentation.summary;m.keyPoints=presentation.keyPoints;m.objectives=presentation.objectives;
   // Keep the source heading: a workflow may copy the task instructions into its title.
   if(m.title.includes('راهنمای تولید:'))m.title=groups[i][0].heading||GC(groups[i][0].text.split('\n')[0],90);
  }else{
   m=qC(groups[i],i,settings,sources);
   if(!m.questions.length&&groups.length>1){const start=i+1<groups.length?i:i-1;if(groups[start].concat(groups[start+1]).reduce((n,s)=>n+s.text.length,0)<=22000){groups.splice(start,2,[...groups[start],...groups[start+1]]);if(start<i)modules.pop();i=start-1;continue;}}
   if(!m.questions.length)throw Error('متن قابل استفاده برای ساخت آزمون کافی نیست. در صورت اسکن بودن جزوه، ابتدا متن آن را با OCR استخراج کنید.');
   await new Promise(r=>setTimeout(r,0));
  }
  m.questions=m.questions.slice(0,settings.questions).map((q,j)=>({...q,id:'m'+(i+1)+'-q'+j}));m.flashcards=m.flashcards.slice(0,settings.cards).map((f,j)=>({...f,id:'m'+(i+1)+'-f'+j}));m.id='m'+(i+1);
  m.questions.forEach(q=>usedQuestions.add(q.question.trim()));m.flashcards.forEach(f=>usedCards.add(f.front.trim()));modules.push(m);
 }
 onProgress(96,'آماده‌سازی ارائهٔ آموزشی و ذخیرهٔ دوره…');const title=settings.title.trim()||sourceName.replace(/\.[^.]+$/,'');
 return kg({version:1,id:crypto.randomUUID(),title,description:settings.mode==='ai'?'آزمون، فلش‌کارت و محتوای ارائه در مرحله‌های مستقل، بر اساس جزوه ساخته شده‌اند.':'دورهٔ استخراجی از متن جزوه با آزمون، کارت‌های مرور و ارائهٔ آموزشی.',mode:settings.mode,createdAt:new Date().toISOString(),sourceName,sources,modules,slides:JC(title,modules),progress:Dg()});
}
