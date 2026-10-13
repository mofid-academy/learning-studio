function MofidPresentationFrame({course,index,onIndex}) {
 const ref=T.useRef(null);
 const html=T.useMemo(()=>mofidOrbitalHTML(course,mfRemoteManifest(course.id)),[course.id,course.title,course.description,course.slides,course.sources,course.modules]);
 T.useEffect(()=>{
  const token=mofidPortalToken;
  const receive=async event=>{
   if(event.source!==ref.current?.contentWindow)return;
   const reply=data=>{if(token===mofidPortalToken&&event.source===ref.current?.contentWindow)event.source.postMessage(data,'*');};
   if(event.data?.type==='mofid-presentation-slide'){
    const next=event.data.index;
    if(Number.isInteger(next)&&next>=0&&next<course.slides.length)onIndex(next);
   }else if(event.data?.type==='mofid-presentation-image'){
    const imageId=event.data.imageId;
    if(typeof imageId!=='string'||!mfRemoteManifest(course.id).some(image=>image.imageId===imageId))return;
    try{reply({type:'mofid-presentation-image-data',imageId,data:await mfRemoteImage(course.id,imageId)});}catch(error){reply({type:'mofid-presentation-image-error',imageId});ym.error(error.message);}
   }else if(event.data?.type==='mofid-presentation-print'){
    try{const full=await mfHydrateCourse(course);reply({type:'mofid-presentation-print-ready',images:full.sources.flatMap((source,si)=>(source.images||[]).map((image,ii)=>({imageId:si+'-'+ii,data:image.data})))});}catch(error){reply({type:'mofid-presentation-print-error'});ym.error(error.message);}
   }
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[course,onIndex]);
 T.useEffect(()=>{ref.current?.contentWindow?.postMessage({type:'mofid-presentation-jump',index},'*');},[index]);
 return (0,H.jsx)('iframe',{ref,title:'ارائهٔ آموزشی '+course.title,srcDoc:html,sandbox:'allow-scripts allow-modals allow-downloads',allow:'fullscreen',allowFullScreen:true,onLoad:()=>ref.current?.contentWindow?.postMessage({type:'mofid-presentation-jump',index},'*'),style:{width:'100%',height:'min(900px,85vh)',minHeight:580,border:'1px solid var(--border)',borderRadius:18,background:'transparent'}});
}
