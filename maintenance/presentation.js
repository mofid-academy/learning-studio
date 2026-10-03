async function SE(course){
 const {default:Pptx}=await Promise.resolve().then(()=>(vE(),rw)),deck=new Pptx();
 deck.layout='LAYOUT_WIDE';deck.author='Mofid Academy';deck.subject=course.sourceName;deck.title=course.title;deck.company='Mofid Academy';deck.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 const pages=course.slides.flatMap(s=>{const chunks=[];let row=[],size=0;for(const value of s.bullets){const words=value.split(/\s+/);let part='';const parts=[];for(const word of words){if(part.length+word.length>300){parts.push(part);part='';}part+=(part?' ':'')+word;}if(part)parts.push(part);for(const text of parts){if(row.length&&(row.length>=3||size+text.length>660)){chunks.push(row);row=[];size=0;}row.push(text);size+=text.length;}}if(row.length)chunks.push(row);if(!chunks.length)chunks.push([]);return chunks.map((bullets,i)=>({...s,bullets,title:s.title+(chunks.length>1?' · '+(i+1):'')}));});
 pages.forEach((page,index)=>{const slide=deck.addSlide(),cover=index===0,dark=cover||index%5===0;const ink=dark?'FFFFFF':'153F3B',muted=dark?'BADED9':'54736F';slide.background={color:dark?'123F3C':'F3F8F7'};
  slide.addShape(deck.ShapeType.rect,{x:0,y:0,w:13.333,h:.12,line:{transparency:100},fill:{color:'00AF9D'}});
  slide.addShape(deck.ShapeType.ellipse,{x:-.6,y:5.6,w:3.6,h:3.6,line:{transparency:100},fill:{color:'00AF9D',transparency:88}});
  slide.addShape(deck.ShapeType.ellipse,{x:11.3,y:-1.4,w:3.3,h:3.3,line:{transparency:100},fill:{color:'F32735',transparency:92}});
  slide.addText('مفید آکادمی  |  استودیوی یادگیری',{x:.7,y:.38,w:11.9,h:.3,fontSize:11,color:muted,rtlMode:true,align:'right',margin:0});
  slide.addText(page.title,{x:.7,y:.98,w:11.9,h:1.08,fontSize:cover?30:25,bold:true,color:ink,align:'right',rtlMode:true,margin:0,fit:'shrink',valign:'middle'});
  const picture=!cover?course.sources.filter(s=>page.sourceIds.includes(s.id)).flatMap(s=>s.images||[]).find(img=>/^data:image\/(png|jpeg);base64,/.test(img.data)):null;
  if(picture){slide.addShape(deck.ShapeType.roundRect,{x:.65,y:2.35,w:4.1,h:3.75,rectRadius:.15,fill:{color:'FFFFFF',transparency:dark?90:0},line:{color:'D9EAE6',transparency:30}});slide.addImage({data:picture.data,...Pptx.imageSizingContain(picture.data,.8,2.5,3.8,3.4)});}
  const x=picture?5:.7,w=picture?7.6:11.9,h=Math.min(1.13,3.75/Math.max(1,page.bullets.length));
  page.bullets.forEach((text,j)=>{const y=2.3+j*(h+.13);slide.addShape(deck.ShapeType.roundRect,{x,y,w,h,rectRadius:.12,fill:{color:'FFFFFF',transparency:dark?92:0},line:{color:dark?'39615D':'DCEAE6',width:.6}});slide.addShape(deck.ShapeType.rect,{x:x+w-.07,y:y+.2,w:.035,h:h-.4,line:{transparency:100},fill:{color:j%2?'F32735':'00AF9D'}});slide.addText(text,{x:x+.22,y:y+.12,w:w-.55,h:h-.24,fontSize:text.length>180?17:21,color:ink,align:'right',rtlMode:true,margin:0,fit:'shrink',valign:'middle'});});
  const refs=page.sourceIds.map(id=>course.sources.find(s=>s.id===id)?.label).filter(Boolean).join('، ');
  slide.addText(refs?'منبع: '+refs:course.sourceName,{x:1.3,y:6.88,w:11.3,h:.24,fontSize:9,color:muted,rtlMode:true,align:'right',fit:'shrink'});
  slide.addText(String(index+1).padStart(2,'0')+' / '+pages.length,{x:.7,y:6.85,w:.9,h:.3,fontSize:10,color:muted,margin:0});
  slide.addShape(deck.ShapeType.rect,{x:.7,y:7.29,w:11.9*(index+1)/pages.length,h:.035,line:{transparency:100},fill:{color:'00AF9D'}});
  slide.addNotes(page.notes+'\n\nمنابع: '+refs+'\nفایل: '+course.sourceName);
 });return deck;
}
