function JC(title, modules) {
 const slides=[{title,bullets:[],notes:modules.map(module=>module.title).join('\n'),sourceIds:[]}];
 const budget=Math.max(2,Math.floor(240/Math.max(1,modules.length))-1);
 for(const module of modules){
  const refs=[...new Set(module.sections.flatMap(section=>section.sourceIds))];
  if(module.objectives?.length)slides.push({title:GC('هدف‌های فصل: '+module.title,480),bullets:module.objectives.slice(0,4).map(text=>GC(text,430)),notes:module.summary.slice(0,19000),sourceIds:[]});
  const pages=[];
  for(const section of module.sections){
   const paragraphs=String(section.body||'').split(/\n+/).map(text=>text.trim()).filter(Boolean);
   const facts=mofidUnique(paragraphs.flatMap(text=>{
    if(text.length<=850)return [text];
    const sentences=HC(text);return sentences.length?sentences:[text];
   }),text=>text);
   let current=[],size=0;
   const push=()=>{if(current.length)pages.push({title:section.title||module.title,parts:current,sourceIds:section.sourceIds});current=[];size=0;};
   for(const fact of facts){if(current.length&&(current.length>=3||size+fact.length>850))push();current.push(fact);size+=fact.length;}
   push();
  }
  if(!pages.length)pages.push({title:module.title,parts:[module.summary],sourceIds:refs});
  const selected=pages.length<=budget?pages:Array.from({length:budget},(_,index)=>pages[Math.floor(index*(pages.length-1)/(budget-1))]);
  selected.forEach((page,index)=>slides.push({title:GC(module.title+' · '+page.title+(selected.length>1?' ('+(index+1)+')':''),480),bullets:page.parts.map(text=>GC(text,650)),notes:page.parts.join('\n\n').slice(0,19000),sourceIds:[...new Set(page.sourceIds)]}));
  if(module.keyPoints.length)slides.push({title:GC('جمع‌بندی فصل: '+module.title,480),bullets:module.keyPoints.slice(0,4).map(text=>GC(text,430)),notes:module.summary.slice(0,19000),sourceIds:[]});
 }
 return slides.slice(0,250);
}
