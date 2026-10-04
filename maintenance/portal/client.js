/* This extension runs in the original bundle scope and reuses its components. */
var mofidParticipant=false, mofidPortalUser=null, mofidPortalToken='', mofidPortalConfig=null;
var mofidLocalLoad=ew, mofidLocalSave=QC, mofidLocalDelete=$C;
var mofidProgressQueue=Promise.resolve();
const mfStyle=document.createElement('link');mfStyle.rel='stylesheet';mfStyle.href='portal.css?v=20261004';document.head.appendChild(mfStyle);
const mfElement=T.createElement;
function mfSessionRead(){try{return JSON.parse(sessionStorage.getItem('mofid-portal-session')||'null')}catch{return null}}
function mfSessionSave(data){mofidPortalToken=data.token;mofidPortalUser=data.user;sessionStorage.setItem('mofid-portal-session',JSON.stringify({token:data.token,user:data.user}));}
function mfSessionClear(){mofidPortalToken='';mofidPortalUser=null;sessionStorage.removeItem('mofid-portal-session');}
async function mfApi(action,payload={}){
 const url=mofidPortalConfig?.apiUrl;
 if(!url||!/^https:\/\//.test(url))throw Error('آدرس سرویس پنل تنظیم نشده است.');
 let response;
 try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload,token:mofidPortalToken}),cache:'no-store'});}catch{throw Error('اتصال به پنل برقرار نشد؛ انتشار ورک‌فلو، اینترنت و تنظیم CORS وبهوک را بررسی کنید.');}
 let data;try{data=await response.json()}catch{throw Error('پاسخ پنل JSON معتبر نیست؛ نود Return Portal Response را بررسی کنید.');}
 if(!response.ok||data.ok!==true){if(response.status===401&&action!=='login'){mfSessionClear();window.dispatchEvent(new Event('mofid-session-expired'));}throw Error(data.error||'درخواست انجام نشد (HTTP '+response.status+').');}
 return data;
}
function mfParticipantStorage(){
 ew=async()=>{const result=await mfApi('courses');return result.courses.map(c=>kg(c)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));};
 QC=c=>{const task=mofidProgressQueue.catch(()=>{}).then(()=>mfApi('progress',{courseId:c.id,progress:c.progress}));mofidProgressQueue=task;return task;};
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
 async function refresh(){setBusy(true);setMessage('');try{const [a,b,c,d]=await Promise.all([mofidLocalLoad(),mfApi('courses'),mfApi('users'),mfApi('reports')]);setLocals(a);setPublished(b.courses);setUsers(c.users);setReports(d.reports);}catch(e){setMessage(e.message)}finally{setBusy(false)}}
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
    ...locals.map(c=>mfElement('div',{className:'source-block',key:c.id},mfElement('div',{className:'row spread'},mfElement('strong',null,c.title),mfElement('button',{className:'btn small primary',disabled:busy,onClick:()=>run(()=>mfApi('publish',{course:kg(c)}))},published.some(p=>p.id===c.id)?'انتشار مجدد':'انتشار برای شرکت‌کننده‌ها')))),
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
 if(mofidParticipant)mfParticipantStorage();else{ew=mofidLocalLoad;QC=mofidLocalSave;$C=mofidLocalDelete;}
 return mfElement(T.Fragment,null,mfElement(JE,{key:mofidParticipant?'participant':'admin'}),
  mfElement('div',{className:'mofid-portal-controls'},!mofidParticipant&&mfElement('button',{className:'btn small',onClick:()=>setManager(true)},'مدیریت دسترسی و انتشار'),user&&mfElement('button',{className:'btn small',onClick:async()=>{try{await mfApi('logout')}catch{}finally{mfSessionClear();location.reload()}}},'خروج: '+user.name)),
  manager&&mfElement(MofidManager,{onClose:()=>setManager(false)}));
}
