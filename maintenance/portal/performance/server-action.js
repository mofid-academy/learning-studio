// This node trusts only the authorization result from the preceding Portal API node.
const crypto=require('crypto');
const context=$('Portal API').first().json;
const body=$('Portal Webhook').first().json.body||{};
const user=context.user;
const records=new Map();
for(const {json:row} of $input.all()){if(typeof row.key==='string'&&typeof row.value==='string')records.set(row.key,JSON.parse(row.value));}
const sha=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const cleanUser=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
const hashPassword=(password,salt)=>crypto.pbkdf2Sync(password,salt,210000,32,'sha256').toString('hex');
const emptyProgress=()=>({read:[],answers:{},reviews:{}});
const publicUser=u=>({username:u.username,name:u.name,organization:u.organization,role:u.role,active:u.active});
const reply=(response,status=200,write=null)=>[{json:{response,status,write:Boolean(write),key:write?.key||'',value:write?JSON.stringify(write.value):''}}];
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const admin=()=>{if(user?.role!=='admin')fail('این عملیات فقط برای سوپرادمین است.',403);};
const courseRecord=id=>{const row=records.get('course:'+id);if(!row?.published)fail('این دوره منتشر نشده یا از دسترس خارج شده است.',404);return row;};
const ownedProgress=id=>records.get('progress:'+user.username+':'+id)?.progress||emptyProgress();
function catalogCourse(c,progress,revision){
  return {version:c.version,id:c.id,title:c.title,description:c.description,mode:c.mode,createdAt:c.createdAt,sourceName:c.sourceName,
    modules:c.modules.map(m=>({id:m.id,title:m.title,questions:m.questions.map(q=>({id:q.id})),flashcards:m.flashcards.map(f=>({id:f.id}))})),
    sources:[],slides:[],progress,_catalog:true,revision};
}
function imageManifest(c){return c.sources.flatMap((s,i)=>(s.images||[]).map((image,j)=>({imageId:i+'-'+j,sourceId:s.id,caption:image.caption})));}
function validatedPreviews(course,previews){
  const result={};let bytes=0;
  if(!previews||typeof previews!=='object'||Array.isArray(previews))return result;
  for(const item of imageManifest(course)){
    const value=previews[item.imageId];
    if(typeof value!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))continue;
    const [si,ii]=item.imageId.split('-').map(Number),original=course.sources[si].images[ii].data;
    if(value.length>=original.length||value.length>300000||bytes+value.length>2000000)continue;
    result[item.imageId]=value;bytes+=value.length;
  }
  return result;
}

function adminRecord(id){
  const row=records.get('draft:'+id)||records.get('course:'+id);
  if(!row?.course)fail('دوره پیدا نشد.',404);
  return row;
}
function readableRecord(id){
  if(body.editor===true){admin();return adminRecord(id);}
  return courseRecord(id);
}
function editorCatalog(){
  const courses=new Map();
  for(const [key,row] of records)if(key.startsWith('course:')&&row.course)courses.set(row.course.id,{...catalogCourse(row.course,row.course.progress||emptyProgress(),row.revision),_editor:true,_hasDraft:false,published:row.published===true});
  for(const [key,row] of records)if(key.startsWith('draft:')&&row.course){
    const published=records.get('course:'+row.course.id)?.published===true;
    if(row.archived){courses.delete(row.course.id);continue;}
    courses.set(row.course.id,{...catalogCourse(row.course,row.course.progress||emptyProgress(),row.revision),_editor:true,_hasDraft:true,published});
  }
  return [...courses.values()];
}
function saveEditorCourse(){
  admin();const c=body.course;
  if(!c||c.version!==1||typeof c.id!=='string'||!c.id||c.id.length>100||typeof c.title!=='string'||!Array.isArray(c.modules)||!c.modules.length||!Array.isArray(c.sources)||!Array.isArray(c.slides))fail('فایل دوره معتبر نیست.');
  const prior=records.get('draft:'+c.id)||records.get('course:'+c.id);
  if(body.createIfMissing===true&&records.has('draft:'+c.id))return reply({ok:true,revision:prior.revision,existing:true});
  if(body.baseRevision&&prior&&body.baseRevision!==prior.revision)fail('نسخهٔ سرور تغییر کرده است؛ دوره را دوباره باز کنید تا ویرایش‌ها بازنویسی نشوند.',409);
  let course=JSON.parse(JSON.stringify(c));
  if(body.imagesDeferred===true){
    if(!prior?.course)fail('نسخهٔ اصلی تصاویر در سرور پیدا نشد؛ دوره را دوباره باز کنید.',409);
    course.sources=course.sources.map(s=>{
      const old=prior.course.sources.find(source=>source.id===s.id);
      return old&&Array.isArray(old.images)?({...s,images:old.images}):s;
    });
  }
  if(Buffer.byteLength(JSON.stringify(course),'utf8')>8*1024*1024)fail('حجم دوره برای ذخیرهٔ مشترک بیشتر از ۸ مگابایت است.',413);
  const revision=sha(JSON.stringify({...course,progress:emptyProgress()}));
  return reply({ok:true,revision,message:'دوره در سرور ذخیره شد.'},200,{key:'draft:'+course.id,value:{course,revision,updatedAt:new Date().toISOString(),archived:false}});
}

try {
  if(!context.authorized||!user)fail('برای ادامه وارد شوید.',401);
  if(body.action==='adminCatalog'){admin();return reply({ok:true,protocol:2,features:{adminStorage:true},courses:editorCatalog(),archivedIds:[...records.entries()].filter(([k,v])=>k.startsWith('draft:')&&v.archived).map(([,v])=>v.course.id)});}
  if(body.action==='saveCourse')return saveEditorCourse();
  if(body.action==='adminCourse'){
    admin();const row=adminRecord(String(body.courseId));
    const course={...row.course,sources:row.course.sources.map(s=>Array.isArray(s.images)?({...s,images:[]}):({...s}))};
    return reply({ok:true,protocol:2,course,revision:row.revision,images:imageManifest(row.course),editor:true});
  }
  if(body.action==='archiveCourse'){
    admin();const row=adminRecord(String(body.courseId));
    return reply({ok:true},200,{key:'draft:'+row.course.id,value:{...row,archived:true,updatedAt:new Date().toISOString()}});
  }
  if(body.action==='catalog')return reply({ok:true,protocol:2,courses:[...records.entries()].filter(([k,v])=>k.startsWith('course:')&&v.published).map(([,v])=>catalogCourse(v.course,ownedProgress(v.course.id),v.revision))});
  if(body.action==='course'){
    const row=courseRecord(String(body.courseId));
    const course={...row.course,progress:ownedProgress(row.course.id),sources:row.course.sources.map(s=>Array.isArray(s.images)?({...s,images:[]}):({...s}))};
    return reply({ok:true,protocol:2,course,revision:row.revision,images:imageManifest(row.course)});
  }
  if(body.action==='images'){
    const row=readableRecord(String(body.courseId));
    if(body.revision&&body.revision!==row.revision)fail('محتوای دوره تغییر کرده است؛ دوره را دوباره باز کنید.',409);
    const ids=Array.isArray(body.imageIds)?[...new Set(body.imageIds)]:[];
    if(!ids.length||ids.length>4)fail('درخواست تصویر معتبر نیست.');
    const images=ids.map(id=>{const match=String(id).match(/^(0|[1-9]\d*)-(0|[1-9]\d*)$/);if(!match)fail('تصویر پیدا نشد.',404);const image=row.course.sources[+match[1]]?.images?.[+match[2]];if(!image)fail('تصویر پیدا نشد.',404);return{imageId:id,data:body.original?image.data:(row.imagePreviews?.[id]||image.data),caption:image.caption};});
    return reply({ok:true,images});
  }
  if(body.action==='courses') {
    const courses=[...records.entries()].filter(([key,v])=>key.startsWith('course:')&&v.published).map(([,v])=>({...v.course,progress:ownedProgress(v.course.id)}));
    return reply({ok:true,courses});
  }
  if(body.action==='publish') {
    admin(); const c=body.course;
    if(!c||c.version!==1||typeof c.id!=='string'||!c.id||c.id.length>100||typeof c.title!=='string'||!Array.isArray(c.modules)||!c.modules.length||!Array.isArray(c.sources)||!Array.isArray(c.slides)) fail('فایل دوره معتبر نیست.');
    if(Buffer.byteLength(JSON.stringify(c),'utf8')>8*1024*1024) fail('حجم دوره برای انتشار در این نسخه بیشتر از ۸ مگابایت است؛ تصاویر جزوه را کوچک‌تر کنید.',413);
    const course=JSON.parse(JSON.stringify(c));course.progress=emptyProgress();
    const imagePreviews=validatedPreviews(course,body.imagePreviews);
    const revision=sha(JSON.stringify(course));
    const previous=records.get('course:'+c.id);
    if(previous&&previous.revision!==revision&&[...records.keys()].some(k=>k.startsWith('progress:')&&k.endsWith(':'+c.id))) fail('این دوره پاسخ ثبت‌شده دارد؛ برای تغییر محتوای آن، نسخهٔ جدید با شناسهٔ جدید منتشر کنید.',409);
    return reply({ok:true,message:'دوره منتشر شد.'},200,{key:'course:'+c.id,value:{course,revision,imagePreviews,published:true,publishedAt:new Date().toISOString()}});
  }
  if(body.action==='unpublish') {
    admin();const key='course:'+String(body.courseId),row=records.get(key);if(!row)fail('دوره پیدا نشد.',404);
    return reply({ok:true},200,{key,value:{...row,published:false}});
  }
  if(body.action==='users') {admin();return reply({ok:true,users:[...records.entries()].filter(([k])=>k.startsWith('user:')).map(([,v])=>publicUser(v))});}
  if(body.action==='createUser') {
    admin();const username=cleanUser(body.username),password=String(body.password||'');
    if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) fail('نام کاربری باید ۳ تا ۸۰ حرف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');
    if((username===context.adminUsername||records.get('user:'+username))) fail('این نام کاربری قبلاً ثبت شده است.',409);
    if(password.length<12||password.length>200) fail('رمز باید دست‌کم ۱۲ نویسه و حداکثر ۲۰۰ نویسه باشد.');
    const salt=crypto.randomBytes(16).toString('hex');
    const u={username,name:String(body.name||'').trim().slice(0,120),organization:String(body.organization||'').trim().slice(0,120),role:'participant',active:true,salt,passwordHash:hashPassword(password,salt),version:crypto.randomBytes(16).toString('hex')};
    if(!u.name||!u.organization)fail('نام و نام سازمان را وارد کنید.');
    return reply({ok:true,user:publicUser(u)},200,{key:'user:'+username,value:u});
  }
  if(body.action==='updateUser') {
    admin();const key='user:'+cleanUser(body.username),u=records.get(key);if(!u)fail('کاربر پیدا نشد.',404);
    const updated={...u,active:typeof body.active==='boolean'?body.active:u.active,version:crypto.randomBytes(16).toString('hex')};
    if(body.password){const p=String(body.password);if(p.length<12||p.length>200)fail('رمز باید ۱۲ تا ۲۰۰ نویسه باشد.');updated.salt=crypto.randomBytes(16).toString('hex');updated.passwordHash=hashPassword(p,updated.salt);}
    return reply({ok:true,user:publicUser(updated)},200,{key,value:updated});
  }
  if(body.action==='progress') {
    const id=String(body.courseId),row=courseRecord(id),c=row.course,p=body.progress||{};
    const moduleIds=new Set(c.modules.map(m=>m.id)),questions=new Map(c.modules.flatMap(m=>m.questions.map(q=>[q.id,q]))),cards=new Set(c.modules.flatMap(m=>m.flashcards.map(f=>f.id)));
    const progress=emptyProgress();
    progress.read=[...new Set((Array.isArray(p.read)?p.read:[]).filter(x=>moduleIds.has(x)))];
    for(const [k,v] of Object.entries(p.answers||{}))if(questions.has(k)&&Number.isInteger(v)&&v>=0&&v<=3)progress.answers[k]=v;
    for(const [k,v] of Object.entries(p.reviews||{}))if(cards.has(k)&&v&&Number.isInteger(v.box)&&v.box>=0&&v.box<=5&&Number.isFinite(v.due))progress.reviews[k]={box:v.box,due:v.due};
    return reply({ok:true},200,{key:'progress:'+user.username+':'+id,value:{username:user.username,courseId:id,progress,updatedAt:new Date().toISOString()}});
  }
  if(body.action==='reports') {
    admin();return reply({ok:true,reports:[...records.entries()].filter(([k])=>k.startsWith('progress:')).map(([,v])=>{const c=records.get('course:'+v.courseId)?.course;const qs=c?.modules.flatMap(m=>m.questions)||[];return{username:v.username,courseId:v.courseId,title:c?.title||v.courseId,read:v.progress.read.length,modules:c?.modules.length||0,answered:Object.keys(v.progress.answers).length,questions:qs.length,correct:qs.filter(q=>v.progress.answers[q.id]===q.answer).length,updatedAt:v.updatedAt};})});
  }
  fail('عملیات ناشناخته است.',400);
} catch(e) { return reply({ok:false,error:e.status?e.message:'پردازش درخواست انجام نشد؛ اجرای n8n را بررسی کنید.'},e.status||500); }
