var mfAdminPersistence=false,mfAdminSaveQueues=new Map(),mfAdminLastSyncError=false;
function mfAdminEnabled(){return mfAdminPersistence&&mofidPortalUser?.role==='admin'&&!mofidParticipant;}
function mfStorageLabel(){return mfAdminEnabled()?'ذخیره در سرور آکادمی':'ذخیره روی این مرورگر';}
async function mfAdminSave(course,options={}){
 const token=mofidPortalToken;
 if(!mfAdminEnabled())return mofidLocalSave(course);
 // Keep a local copy as well; server confirmation controls the saved status.
 const prior=mfAdminSaveQueues.get(course.id)||Promise.resolve();
 const task=prior.catch(()=>{}).then(async()=>{
  try{await mofidLocalSave(course);}catch{}
  if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است؛ دوره ذخیره نشد.');
  const meta=mfRemoteCourses.get(course.id);
  const imagesDeferred=Boolean(meta?.images.length)&&!course.sources.some(source=>source.images?.length);
  const result=await mfApi('saveCourse',{course:kg(course),imagesDeferred,baseRevision:meta?.revision,createIfMissing:options.createIfMissing===true});
  if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است.');
  mfRemoteCourses.set(course.id,{revision:result.revision,images:meta?.images||[],editor:true});
  return result;
 });
 mfAdminSaveQueues.set(course.id,task);
 try{return await task;}finally{if(mfAdminSaveQueues.get(course.id)===task)mfAdminSaveQueues.delete(course.id);}
}
async function mfAdminLoad(){
 const local=await mofidLocalLoad().catch(()=>[]);mfAdminLastSyncError=false;
 let remote,archived=[];
 if(mfAdminEnabled()){
  let result=await mfApi('adminCatalog');remote=result.courses;archived=result.archivedIds||[];
  const byId=new Map(remote.map(course=>[course.id,course]));let migrated=false;
  for(const course of local){
   if(archived.includes(course.id)||byId.get(course.id)?._hasDraft)continue;
   try{await mfAdminSave(course,{createIfMissing:true});migrated=true;}catch(error){mfAdminLastSyncError=true;ym.error('نسخهٔ محلی حفظ شد، اما ذخیرهٔ دائمی دوره انجام نشد: '+error.message);}
  }
  if(migrated){result=await mfApi('adminCatalog');remote=result.courses;archived=result.archivedIds||[];}
 }else remote=await mfPublishedCourses();
 const merged=new Map(local.filter(course=>!archived.includes(course.id)).map(course=>[course.id,course]));
 for(const course of remote)if(course._hasDraft||!merged.has(course.id))merged.set(course.id,course);
 return [...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
async function mfAdminArchive(courseId){
 if(mfAdminEnabled()){
  const token=mofidPortalToken,prior=mfAdminSaveQueues.get(courseId)||Promise.resolve();
  const task=prior.catch(()=>{}).then(()=>{if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است.');return mfApi('archiveCourse',{courseId});});
  mfAdminSaveQueues.set(courseId,task);try{await task;}finally{if(mfAdminSaveQueues.get(courseId)===task)mfAdminSaveQueues.delete(courseId);}
 }
 try{await mofidLocalDelete(courseId);}catch(error){if(!mfAdminEnabled())throw error;}
 mfRemoteCourses.delete(courseId);
}
function mfAdminStorage(){ew=mfAdminLoad;QC=mfAdminSave;$C=mfAdminArchive;}

// Remote content stays in this signed-in page's memory, never in public files or shared browser storage.
var mfProtocol=1,mfOpenSerial=0,mfImageActive=0,mfImageTimer=null;
var mfRemoteCourses=new Map(),mfImageCache=new Map(),mfImageQueue=[];
function mfClearContent(){
 mfOpenSerial++;mfProtocol=1;mfAdminPersistence=false;mfAdminSaveQueues.clear();mfRemoteCourses.clear();mfImageCache.clear();
 const queued=mfImageQueue.splice(0);queued.forEach(job=>job.reject(Error('نشست تغییر کرده است؛ دوباره وارد شوید.')));
}
function mfRemoteManifest(courseId){return mfRemoteCourses.get(courseId)?.images||[];}
async function mfPublishedCourses(){
 const result=await mfApi(mfProtocol>=2?'catalog':'courses');
 return mfProtocol>=2?result.courses:result.courses.map(c=>kg(c));
}
async function mfLoadCourse(course){
 if(mfProtocol<2||(!mofidParticipant&&!course._catalog))return course;
 const token=mofidPortalToken;
 const result=await mfApi(mfAdminEnabled()?'adminCourse':'course',{courseId:course.id});
 if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است؛ دوباره وارد شوید.');
 const full=kg(result.course);
 mfRemoteCourses.set(full.id,{revision:result.revision,images:result.images||[],editor:result.editor===true});
 return full;
}
function mfRemoteImage(courseId,imageId,original=false){
 const meta=mfRemoteCourses.get(courseId),token=mofidPortalToken;
 if(!meta||!meta.images.some(i=>i.imageId===imageId))return Promise.reject(Error('تصویر پیدا نشد.'));
 const key=[token,courseId,meta.revision,imageId,original].join('|');
 if(mfImageCache.has(key))return mfImageCache.get(key);
 const promise=new Promise((resolve,reject)=>mfImageQueue.push({courseId,imageId,original,revision:meta.revision,token,key,resolve,reject}));
 mfImageCache.set(key,promise);
 if(!mfImageTimer)mfImageTimer=setTimeout(()=>{mfImageTimer=null;mfPumpImages();},40);
 return promise;
}
function mfPumpImages(){
 while(mfImageActive<2&&mfImageQueue.length){
  const first=mfImageQueue.shift(),batch=[first];
  for(let i=0;i<mfImageQueue.length&&batch.length<4;){const job=mfImageQueue[i];if(job.courseId===first.courseId&&job.revision===first.revision&&job.token===first.token&&job.original===first.original){batch.push(job);mfImageQueue.splice(i,1);}else i++;}
  mfImageActive++;
  (async()=>{
   try{
    if(first.token!==mofidPortalToken)throw Error('نشست تغییر کرده است؛ دوباره وارد شوید.');
    const r=await mfApi('images',{courseId:first.courseId,revision:first.revision,imageIds:batch.map(j=>j.imageId),original:first.original,editor:mfRemoteCourses.get(first.courseId)?.editor===true});
    if(first.token!==mofidPortalToken)throw Error('نشست تغییر کرده است؛ دوباره وارد شوید.');
    for(const job of batch){const item=r.images?.find(i=>i.imageId===job.imageId);if(!item||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(item.data||'')){mfImageCache.delete(job.key);job.reject(Error('تصویر معتبر دریافت نشد.'));}else job.resolve(item.data);}
   }catch(error){for(const job of batch){mfImageCache.delete(job.key);job.reject(error);}}
   finally{mfImageActive--;mfPumpImages();}
  })();
 }
}
async function mfHydrateCourse(course){
 const manifest=mfRemoteManifest(course.id);
 if(!manifest.length)return course;
 const token=mofidPortalToken;
 const images=await Promise.all(manifest.map(async item=>({...item,data:await mfRemoteImage(course.id,item.imageId,true)})));
 if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است؛ دوباره وارد شوید.');
 return kg({...course,sources:course.sources.map((source,index)=>{
  const found=images.filter(image=>image.imageId.startsWith(index+'-')).sort((a,b)=>Number(a.imageId.split('-')[1])-Number(b.imageId.split('-')[1])).map(image=>({data:image.data,caption:image.caption}));
  return found.length||Array.isArray(source.images)?({...source,images:found}):source;
 })});
}
async function mfExportCourse(course,exporter){try{return await exporter(await mfHydrateCourse(course));}catch(error){ym.error(error.message||'خروجی دوره آماده نشد.');}}
async function mfImagePreviews(course){
 const result={};let budget=0;
 for(let si=0;si<course.sources.length;si++)for(let ii=0;ii<(course.sources[si].images||[]).length;ii++){
  const image=course.sources[si].images[ii];
  if(!/^data:image\/(jpeg|png|webp);base64,/.test(image.data)||image.data.length<120000||budget>=2000000)continue;
  try{
   const bitmap=await new Promise((resolve,reject)=>{const img=new Image();const timeout=setTimeout(()=>reject(Error('image timeout')),4000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=()=>{clearTimeout(timeout);reject(Error('image decode'));};img.src=image.data;});
   const scale=Math.min(1,1600/Math.max(bitmap.naturalWidth,bitmap.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.naturalWidth*scale));canvas.height=Math.max(1,Math.round(bitmap.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx)continue;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   // Keep PNG transparency and text; originals are always retained separately.
   const mime=image.data.startsWith('data:image/png;')?'image/png':image.data.startsWith('data:image/webp;')?'image/webp':'image/jpeg';
   const data=canvas.toDataURL(mime,.92);
   if(data.length<image.data.length*.9&&data.length<=300000&&budget+data.length<=2000000){result[si+'-'+ii]=data;budget+=data.length;}
   canvas.width=canvas.height=1;
  }catch{}
 }
 return result;
}
async function mfPublishCourse(course){const loaded=course._catalog?await mfLoadCourse(course):course;const full=kg(await mfHydrateCourse(loaded));const imagePreviews=await mfImagePreviews(full);return mfApi('publish',{course:full,imagePreviews});}
function MofidLazySourceImage({image,courseId,index}){
 const ref=T.useRef(null),[data,setData]=T.useState(image.data||'');
 T.useEffect(()=>{
  if(image.data){setData(image.data);return;}
  let alive=true;const load=()=>mfRemoteImage(courseId,image.imageId).then(value=>{if(alive)setData(value);}).catch(error=>{if(alive)ym.error(error.message);});
  if(typeof IntersectionObserver==='undefined'){void load();return()=>{alive=false;};}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();void load();}},{rootMargin:'150px'});
  if(ref.current)observer.observe(ref.current);return()=>{alive=false;observer.disconnect();};
 },[courseId,image.imageId,image.data]);
 const download=async event=>{if(image.data)return;event.preventDefault();try{const original=await mfRemoteImage(courseId,image.imageId,true);const a=document.createElement('a');a.href=original;a.download='source-image-'+(index+1);document.body.appendChild(a);a.click();a.remove();}catch(error){ym.error(error.message);}};
 return (0,H.jsx)('a',{ref,href:data||'#',download:'source-image-'+(index+1),onClick:download,children:(0,H.jsx)('img',{src:data||undefined,alt:image.caption,loading:'lazy',decoding:'async',style:data?undefined:{visibility:'hidden',minHeight:180}})});
}
function MofidSourceGallery({sources,courseId}){
 const [open,setOpen]=T.useState(false);
 const remote=mfRemoteManifest(courseId),images=remote.length?remote:sources.flatMap(source=>(source.images||[]).map(image=>({...image,label:source.label})));
 if(!images.length)return null;
 return (0,H.jsxs)('details',{className:'panel source-gallery',onToggle:event=>setOpen(event.currentTarget.open),children:[(0,H.jsxs)('summary',{children:['تصاویر جزوه (',Og(images.length),')']}),open&&(0,H.jsx)('div',{children:images.map((image,index)=>(0,H.jsxs)('figure',{children:[(0,H.jsx)(MofidLazySourceImage,{image,courseId,index}),(0,H.jsxs)('figcaption',{children:[image.caption,' · برای دریافت تصویر کلیک کنید']})]},image.imageId||index))})]});
}

/* This extension runs in the original bundle scope and reuses its components. */
var mofidParticipant=false, mofidPortalUser=null, mofidPortalToken='', mofidPortalConfig=null;
var mofidLocalLoad=ew, mofidLocalSave=QC, mofidLocalDelete=$C;
var mofidProgressQueue=Promise.resolve();
const mfStyle=document.createElement('link');mfStyle.rel='stylesheet';mfStyle.href='portal.css?v=20261004';document.head.appendChild(mfStyle);
const mfElement=T.createElement;
function mfSessionRead(){try{return JSON.parse(sessionStorage.getItem('mofid-portal-session')||'null')}catch{return null}}
function mfSessionSave(data){mofidPortalToken=data.token;mofidPortalUser=data.user;sessionStorage.setItem('mofid-portal-session',JSON.stringify({token:data.token,user:data.user}));}
function mfSessionClear(){mfClearContent();mofidPortalToken='';mofidPortalUser=null;sessionStorage.removeItem('mofid-portal-session');}
async function mfApi(action,payload={}){
 const url=mofidPortalConfig?.apiUrl;
 if(!url||!/^https:\/\//.test(url))throw Error('آدرس سرویس پنل تنظیم نشده است.');
 let response;
 try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload,token:mofidPortalToken}),cache:'no-store'});}catch{throw Error('اتصال به پنل برقرار نشد؛ انتشار ورک‌فلو، اینترنت و تنظیم CORS وبهوک را بررسی کنید.');}
 let data;try{data=await response.json()}catch{throw Error('پاسخ پنل JSON معتبر نیست؛ نود Return Portal Response را بررسی کنید.');}
 if(!response.ok||data.ok!==true){if(response.status===401&&action!=='login'){mfSessionClear();window.dispatchEvent(new Event('mofid-session-expired'));}const error=Error(data.error||'درخواست انجام نشد (HTTP '+response.status+').');error.status=response.status;throw error;}
 if(data.protocol===2)mfProtocol=2;if(data.features?.adminStorage===true)mfAdminPersistence=true;
 return data;
}
function mfParticipantStorage(){
 ew=async()=>{const courses=await mfPublishedCourses();return courses.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));};
 QC=c=>{const token=mofidPortalToken;const task=mofidProgressQueue.catch(()=>{}).then(()=>{if(token!==mofidPortalToken)throw Error('نشست تغییر کرده است.');return mfApi('progress',{courseId:c.id,progress:c.progress});});mofidProgressQueue=task;return task;};
 $C=async()=>{throw Error('حذف دوره برای شرکت‌کننده مجاز نیست.');};
}
function mfField(label,id,props){return mfElement('div',{className:'field',key:id},mfElement('label',{htmlFor:id},label),mfElement('input',{id,...props}));}
function mfMessage(message){return message?mfElement('div',{className:'notice',role:'status'},message):null;}
function MofidLogin({onLogin,participant=true}){
 const [username,setUsername]=T.useState(''),[password,setPassword]=T.useState(''),[busy,setBusy]=T.useState(false),[error,setError]=T.useState('');
 return mfElement('section',{className:'panel',style:{maxWidth:460,margin:'8vh auto',padding:28}},
  mfElement('h1',null,participant?'ورود شرکت‌کننده':'ورود سوپرادمین'),
  mfElement('p',{className:'small-text muted',style:{margin:'12px 0'}},'مفید آکادمی · استودیوی یادگیری'),
  mfElement('form',{onSubmit:async e=>{e.preventDefault();setBusy(true);setError('');try{const d=await mfApi('login',{username,password});if(!participant&&d.user.role!=='admin')throw Error('این حساب دسترسی سوپرادمین ندارد.');mfSessionSave(d);setPassword('');onLogin(d.user);}catch(e){setError(e.message)}finally{setBusy(false)}}},
   mfField('نام کاربری','portal-username',{value:username,onChange:e=>setUsername(e.target.value),autoComplete:'username',required:true,maxLength:80,dir:'ltr'}),
   mfField('رمز عبور','portal-password',{value:password,onChange:e=>setPassword(e.target.value),type:'password',autoComplete:'current-password',required:true,maxLength:200}),
   mfMessage(error),mfElement('button',{className:'btn primary',type:'submit',disabled:busy||!username||!password,style:{marginTop:18}},busy?'در حال ورود…':'ورود')),
  mfElement('p',{className:'small-text muted',style:{marginTop:16}},'حساب جدید را فقط مدیر آکادمی ایجاد می‌کند.'));
}
function MofidManager({onClose}){
 const [user,setUser]=T.useState(mofidPortalUser),[tab,setTab]=T.useState('courses'),[locals,setLocals]=T.useState([]),[published,setPublished]=T.useState([]),[users,setUsers]=T.useState([]),[reports,setReports]=T.useState([]),[message,setMessage]=T.useState(''),[busy,setBusy]=T.useState(false);
 const [form,setForm]=T.useState({username:'',name:'',organization:'',password:''});
 const [url,setUrl]=T.useState(mofidPortalConfig?.apiUrl||'');
 async function refresh(){setBusy(true);setMessage('');try{const [a,b,c,d]=await Promise.all([(mfAdminEnabled()?mfAdminLoad():mofidLocalLoad()),mfPublishedCourses(),mfApi('users'),mfApi('reports')]);setLocals(a);setPublished(b);setUsers(c.users);setReports(d.reports);}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 T.useEffect(()=>{if(user?.role==='admin')void refresh()},[user]);
 const run=async fn=>{if(busy)return;setBusy(true);setMessage('');try{await fn();await refresh();setMessage('ذخیره شد.')}catch(e){setMessage(e.message)}finally{setBusy(false)}};
 const link=new URL('?portal=participant',location.href).href;
 const input=(key,label,type='text')=>mfField(label,'manage-'+key,{type,value:form[key],onChange:e=>setForm({...form,[key]:e.target.value}),required:true,maxLength:key==='password'?200:120,autoComplete:key==='password'?'new-password':'off',dir:key==='username'?'ltr':undefined});
 return mfElement('div',{className:'mofid-portal-overlay',role:'dialog','aria-modal':true,'aria-labelledby':'portal-manager-title'},mfElement('section',{className:'panel mofid-portal-dialog'},
  mfElement('div',{className:'row spread'},mfElement('h2',{id:'portal-manager-title'},'مدیریت دسترسی و انتشار دوره'),mfElement('button',{className:'btn small',onClick:onClose},'بستن')),
  !user||user.role!=='admin'?mfElement(T.Fragment,null,
   mfField('آدرس وبهوک پنل مشترک','portal-api-url',{type:'url',value:url,onChange:e=>{setUrl(e.target.value);mofidPortalConfig={...mofidPortalConfig,apiUrl:e.target.value}},dir:'ltr'}),
   mfElement(MofidLogin,{participant:false,onLogin:setUser})):
  mfElement(T.Fragment,null,
   mfElement('p',{className:'small-text muted',style:{margin:'16px 0'}},'حساب مدیر: '+user.username+' · دوره‌ها فقط پس از انتشار در پنل شرکت‌کننده نمایش داده می‌شوند.'),
   mfElement('div',{className:'row',style:{flexWrap:'wrap',marginBottom:18}},...['courses','users','reports'].map((key,i)=>mfElement('button',{className:'btn small '+(tab===key?'primary':''),onClick:()=>setTab(key),key},['انتشار دوره‌ها','حساب شرکت‌کننده‌ها','عملکرد شرکت‌کننده‌ها'][i])),mfElement('button',{className:'btn small',disabled:busy,onClick:refresh},'به‌روزرسانی'),mfElement('button',{className:'btn small',onClick:async()=>{try{await mfApi('logout')}finally{mfSessionClear();location.reload()}}},'خروج')),
   mfElement('div',{className:'notice',style:{display:'block',marginBottom:18}},mfElement('strong',null,'لینک شرکت‌کننده‌ها'),mfElement('a',{href:link,target:'_blank',rel:'noopener noreferrer',style:{display:'block',overflowWrap:'anywhere',marginTop:8}},link),!mofidPortalConfig.enabled&&mfElement('p',{className:'small-text'},'پس از آزمون اتصال، enabled را در portal-config.json روی true بگذارید تا ورود مشترک فعال شود.')),
   tab==='courses'&&mfElement(T.Fragment,null,
    mfElement('p',{className:'small-text muted'},'انتشار، یک نسخه از محتوای دوره را ذخیره می‌کند. پاسخ‌ها و پیشرفت شما با شرکت‌کننده‌ها به اشتراک گذاشته نمی‌شوند.'),
    ...locals.map(c=>mfElement('div',{className:'source-block',key:c.id},mfElement('div',{className:'row spread'},mfElement('strong',null,c.title),mfElement('button',{className:'btn small primary',disabled:busy,onClick:()=>run(()=>mfPublishCourse(c))},published.some(p=>p.id===c.id)?'انتشار مجدد':'انتشار برای شرکت‌کننده‌ها')))),
    !locals.length&&mfElement('p',null,'هنوز دوره‌ای در این مرورگر ساخته نشده است.'),
    mfElement('h3',{style:{marginTop:24}},'دوره‌های منتشرشده'),...published.map(c=>mfElement('div',{className:'source-block',key:c.id},mfElement('div',{className:'row spread'},mfElement('strong',null,c.title),mfElement('button',{className:'btn small',disabled:busy,onClick:()=>{if(confirm('دسترسی شرکت‌کننده‌ها به این دوره بسته شود؟ پاسخ‌ها حفظ می‌شوند.'))void run(()=>mfApi('unpublish',{courseId:c.id}))}},'بستن دسترسی'))))),
   tab==='users'&&mfElement(T.Fragment,null,
    mfElement('form',{onSubmit:e=>{e.preventDefault();void run(async()=>{await mfApi('createUser',form);setForm({username:'',name:'',organization:'',password:''})})}},mfElement('div',{className:'field-grid'},input('username','نام کاربری'),input('name','نام و نام خانوادگی'),input('organization','نام سازمان'),input('password','رمز عبور (حداقل ۱۲ نویسه)','password')),mfElement('button',{type:'submit',className:'btn primary',disabled:busy},'ایجاد حساب شرکت‌کننده')),
    ...users.map(u=>mfElement('div',{className:'source-block',key:u.username},mfElement('strong',null,u.name+' · '+u.organization),mfElement('p',{className:'small-text'},u.username+' · '+(u.active?'فعال':'غیرفعال')),mfElement('div',{className:'row'},mfElement('button',{className:'btn small',disabled:busy,onClick:()=>run(()=>mfApi('updateUser',{username:u.username,active:!u.active}))},u.active?'لغو دسترسی':'فعال‌سازی'),mfElement('button',{className:'btn small',disabled:busy,onClick:()=>{const password=prompt('رمز جدید (حداقل ۱۲ نویسه):');if(password)void run(()=>mfApi('updateUser',{username:u.username,password}))}},'تغییر رمز'))))),
   tab==='reports'&&mfElement('div',{style:{overflowX:'auto'}},mfElement('table',{className:'mofid-portal-table'},mfElement('thead',null,mfElement('tr',null,...['کاربر','دوره','مطالعه','پاسخ ثبت‌شده','پاسخ صحیح'].map(x=>mfElement('th',{key:x},x)))),mfElement('tbody',null,...reports.map((r,i)=>mfElement('tr',{key:i},... [r.username,r.title,r.read+' / '+r.modules,r.answered+' / '+r.questions,r.correct+' / '+r.answered].map((x,j)=>mfElement('td',{key:j},x)))))))),
  mfMessage(message),busy&&mfElement('p',{role:'status',className:'small-text'},'در حال دریافت یا ذخیره…')));
}
function MofidGateway(){
 const [ready,setReady]=T.useState(false),[user,setUser]=T.useState(null),[manager,setManager]=T.useState(false),[error,setError]=T.useState('');
 const participant=new URLSearchParams(location.search).get('portal')==='participant';
 T.useEffect(()=>{let alive=true;async function init(){try{const r=await fetch('portal-config.json?v=20261004',{cache:'no-store'});if(!r.ok)throw Error('تنظیمات پنل دریافت نشد.');const config=await r.json();if(typeof config.enabled!=='boolean'||typeof config.apiUrl!=='string')throw Error('تنظیمات پنل معتبر نیست.');mofidPortalConfig=config;const saved=mfSessionRead();if(config.enabled&&saved?.token){mofidPortalToken=saved.token;try{const me=await mfApi('me');mofidPortalUser=me.user;if(alive)setUser(me.user)}catch(e){mfSessionClear();if(alive)setError(e.message)}}}catch(e){if(alive)setError(e.message)}finally{if(alive)setReady(true)}}void init();const expired=()=>{setUser(null);setError('نشست شما پایان یافته است؛ دوباره وارد شوید.')};window.addEventListener('mofid-session-expired',expired);return()=>{alive=false;window.removeEventListener('mofid-session-expired',expired)}},[]);
 if(!ready)return mfElement('div',{className:'notice',style:{margin:32}},'در حال بررسی ورود…');
 if(!mofidPortalConfig)return mfElement('div',{className:'notice error',style:{margin:32}},error,mfElement('button',{className:'btn',onClick:()=>location.reload()},'تلاش دوباره'));
 if(participant&&!mofidPortalConfig.enabled)return mfElement('div',{className:'panel',style:{maxWidth:540,padding:32,margin:'10vh auto'}},mfElement('h1',null,'پنل شرکت‌کننده‌ها هنوز فعال نشده است'),mfElement('p',null,'مدیر آکادمی باید اتصال سرویس ورود و دوره‌ها را تکمیل کند.'));
 if(mofidPortalConfig.enabled&&!user)return mfElement(T.Fragment,null,mfMessage(error),mfElement(MofidLogin,{participant,onLogin:setUser}));
 mofidParticipant=!!user&&(user.role==='participant'||participant);
 if(mofidParticipant)mfParticipantStorage();else if(user?.role==='admin')mfAdminStorage();else{ew=mofidLocalLoad;QC=mofidLocalSave;$C=mofidLocalDelete;}
 return mfElement(T.Fragment,null,mfElement(JE,{key:mofidParticipant?'participant':'admin'}),
  mfElement('div',{className:'mofid-portal-controls'},!mofidParticipant&&mfElement('button',{className:'btn small',onClick:()=>setManager(true)},'مدیریت دسترسی و انتشار'),user&&mfElement('button',{className:'btn small',onClick:async()=>{try{await mfApi('logout')}catch{}finally{mfSessionClear();location.reload()}}},'خروج: '+user.name)),
  manager&&mfElement(MofidManager,{onClose:()=>setManager(false)}));
}
