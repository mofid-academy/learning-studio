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
function qC(group,index,settings,all){
 const id='m'+(index+1),first=group[0],title=GC(first.heading||first.text.split('\n').find(x=>x.length>4&&x.length<120)||first.label,90);
 const facts=mofidUnique(group.flatMap(s=>HC(s.text).filter(t=>t.length>=28&&t.length<1100).map(t=>({t,source:s.id}))),x=>x.t);
 const vocab=[...new Set(WC(all.map(s=>s.text).join(' ')))],questions=[];
 for(const fact of facts){if(questions.length>=settings.questions)break;const keys=[...new Set(WC(fact.t))].sort((a,b)=>b.length-a.length);const key=keys.find(k=>vocab.filter(w=>w!==k&&!fact.t.includes(w)).length>=3);if(!key)continue;const options=vocab.filter(w=>w!==key&&!fact.t.includes(w)).sort((a,b)=>Math.abs(a.length-key.length)-Math.abs(b.length-key.length)).slice(0,3);const answer=questions.length%4;options.splice(answer,0,key);questions.push({id:id+'-q'+questions.length,question:'طبق جزوه، جای خالی را کامل کنید:\n'+fact.t.replaceAll(key,'ــــــ'),options,answer,explanation:fact.t,sourceIds:[fact.source]});}
 const tested=new Set(questions.map(q=>q.explanation));const cardFacts=[...facts.filter(f=>!tested.has(f.t)),...facts.filter(f=>tested.has(f.t))];
 const flashcards=cardFacts.slice(0,settings.cards).map((f,j)=>{const concept=WC(f.t).sort((a,b)=>b.length-a.length)[0]||title;return{id:id+'-f'+j,front:'ارتباط «'+[...new Set(WC(f.t))].sort((a,b)=>b.length-a.length).slice(0,2).join('» و «')+'» را طبق جزوه توضیح دهید.',back:f.t,sourceIds:[f.source]};});
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
async function YC(sources,sourceName,settings,onProgress,signal,auth){
 let groups=KC(sources,settings.modules),modules=[];
 const credentials=auth?.username&&auth.password?btoa(String.fromCharCode(...new TextEncoder().encode(auth.username+':'+auth.password))):'';
 async function request(group,index,task,avoid=[]){
  const directions={quiz:'آزمون مستقل طراحی کن: سؤال‌های مفهومی، مقایسه‌ای و کاربردی متنوع، چهار گزینه معتبر و توضیح پاسخ. از سؤال‌های کلی و تکراری پرهیز کن.',cards:'فلش‌کارت مستقل برای بازیابی فعال طراحی کن: تعریف، رابطه، علت و مقایسه. صورت سؤال آزمون را کپی نکن. کارت جای خالی و کارت چندگزینه‌ای نساز.',presentation:'محتوای یک ارائه آموزشی مستقل بساز. sections شامل توضیح منسجم مفاهیم، روابط و مثال‌های موجود در منبع باشد؛ keyPoints جمع‌بندی باشد. صرفاً سؤال یا فلش‌کارت را به اسلاید تبدیل نکن.'};
  const instruction=directions[task]+' فقط به منابع تکیه کن؛ واقعیت یا مثال خارج از جزوه نساز. تعداد خروجی متناسب با محتوای واقعی باشد. '+(avoid.length?'این صورت سؤال‌ها را تکرار نکن: '+avoid.slice(0,20).join(' | '):'');
  const response=await fetch('https://miladmirsheriseyed.app.n8n.cloud/webhook/mofid-learning-module-gemini',{method:'POST',headers:{'Content-Type':'application/json',...(credentials?{Authorization:'Basic '+credentials}:{})},body:JSON.stringify({sources:group.map(({images,...s})=>s),title:(settings.title||'دوره آموزشی')+'\nراهنمای تولید: '+instruction,instructions:instruction,task,moduleNumber:index+1,questions:Math.max(1,settings.questions),cards:Math.max(1,settings.cards)}),signal,redirect:'error'});
  let data;try{data=await response.json();}catch{throw Error('پاسخ وبهوک JSON معتبر نیست. خروجی نود آخر n8n را بررسی کنید.');}
  if(!response.ok)throw Error(data.error||'تولید محتوا انجام نشد (HTTP '+response.status+').');
  if(Array.isArray(data))data=data[0];let raw=data.module??data;
  if(typeof raw==='string'){raw=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));raw=raw.module??raw;}
  const m=wg.parse({...raw,id:'m'+(index+1),objectives:raw.objectives||[],keyPoints:raw.keyPoints||[],questions:(raw.questions||[]).map((q,j)=>({...q,id:'q'+j})),flashcards:(raw.flashcards||[]).map((f,j)=>({...f,id:'f'+j}))});
  const refs=new Set(group.map(s=>s.id));for(const x of [...m.sections,...m.questions,...m.flashcards])if(x.sourceIds.some(id=>!refs.has(id)))throw Error('خروجی هوش مصنوعی ارجاع نامعتبر دارد.');
  return m;
 }
 const usedQuestions=new Set(),usedCards=new Set();
 for(let i=0;i<groups.length;i++){
  if(signal?.aborted)throw new DOMException('لغو شد','AbortError');let m;
  onProgress(Math.round(i/groups.length*88),'ساخت آزمون فصل '+(i+1)+' از '+groups.length+'…');
  if(settings.mode==='ai'){
   m=await request(groups[i],i,'quiz',[...usedQuestions]);m.questions=mofidUnique(m.questions,q=>q.question).filter(q=>!usedQuestions.has(q.question.trim()));
   if(!m.questions.length&&groups.length>1){const j=i+1<groups.length?i+1:i-1;const start=Math.min(i,j),merged=[...groups[start],...groups[start+1]];if(merged.reduce((n,s)=>n+s.text.length,0)<=22000){groups.splice(start,2,merged);if(j<i){modules.pop();usedQuestions.clear();usedCards.clear();for(const old of modules){old.questions.forEach(q=>usedQuestions.add(q.question.trim()));old.flashcards.forEach(f=>usedCards.add(f.front.trim()));}}i=start-1;continue;}}
   if(!m.questions.length)throw Error('برای این متن سؤال معتبر تولید نشد. متن استخراج‌شده یا خروجی مدل را بررسی کنید؛ فصل خالی ذخیره نشد.');
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
