function MofidPresentationFrame({course,index,onIndex}) {
 const ref=T.useRef(null);
 const html=T.useMemo(()=>mofidOrbitalHTML(course),[course.title,course.description,course.slides,course.sources,course.modules]);
 T.useEffect(()=>{
  const receive=event=>{
   if(event.source!==ref.current?.contentWindow||event.data?.type!=='mofid-presentation-slide')return;
   const next=event.data.index;
   if(Number.isInteger(next)&&next>=0&&next<course.slides.length)onIndex(next);
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[course.slides.length,onIndex]);
 T.useEffect(()=>{ref.current?.contentWindow?.postMessage({type:'mofid-presentation-jump',index},'*');},[index]);
 return (0,H.jsx)('iframe',{ref,title:'ارائهٔ آموزشی '+course.title,srcDoc:html,sandbox:'allow-scripts allow-modals allow-downloads',allow:'fullscreen',allowFullScreen:true,onLoad:()=>ref.current?.contentWindow?.postMessage({type:'mofid-presentation-jump',index},'*'),style:{width:'100%',height:'min(900px,85vh)',minHeight:580,border:'1px solid var(--border)',borderRadius:18,background:'transparent'}});
}
