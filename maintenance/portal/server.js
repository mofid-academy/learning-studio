// n8n Code node: Run Once for All Items. Keep this configuration in n8n only.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD';
const crypto = require('crypto');
const input = $('Portal Webhook').first().json;
const body = input.body || {};
const records = new Map();
for (const item of $input.all()) {
  const row = item.json;
  if (typeof row.key !== 'string' || typeof row.value !== 'string') continue;
  try { records.set(row.key, JSON.parse(row.value)); } catch { throw new Error('یک رکورد ذخیره‌شده خراب است؛ جدول را بررسی کنید.'); }
}
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const cleanUser = value => String(value || '').normalize('NFKC').trim().toLowerCase();
const hashPassword = (password, salt) => crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
const equal = (a,b) => { const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length && crypto.timingSafeEqual(x,y); };
const emptyProgress = () => ({read:[],answers:{},reviews:{}});
const publicUser = u => ({username:u.username,name:u.name,organization:u.organization,role:u.role,active:u.active});
const reply = (response,status=200,write=null) => [{json:{response,status,write:Boolean(write),key:write?.key||'',value:write?JSON.stringify(write.value):''}}];
const fail = (message,status=400) => { const e=new Error(message);e.status=status;throw e; };
const adminVersion = sha(ADMIN_USERNAME+'\0'+ADMIN_PASSWORD);
const adminUser = {username:cleanUser(ADMIN_USERNAME),name:'مدیر آکادمی',organization:'مفید آکادمی',role:'admin',active:true,version:adminVersion};
const userRecord = username => username===adminUser.username?adminUser:records.get('user:'+username);
const now=Date.now();
try {
  const origin=input.headers?.origin;
  if(origin && origin!=='https://mofid-academy.github.io') fail('این مبدأ مجاز نیست.',403);
  if(ADMIN_PASSWORD==='CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD'||ADMIN_PASSWORD.length<16) fail('رمز سوپرادمین در نود Portal API هنوز تنظیم نشده است.',503);
  if(body.action==='login') {
    const username=cleanUser(body.username), password=String(body.password||'');
    if(username.length>80||password.length>200) fail('نام کاربری یا رمز اشتباه است.',401);
    const attemptKey='attempt:'+sha(username),prior=records.get(attemptKey);
    const attempt=prior&&prior.until>now?prior:{count:0,until:now+15*60*1000};
    if(attempt.count>=5)fail('تعداد تلاش‌های ناموفق زیاد است؛ ۱۵ دقیقه بعد دوباره تلاش کنید.',429);
    const u=userRecord(username);
    const derived=hashPassword(password,u?.salt||'invalid-account-salt');
    const valid=u?.active && (u.role==='admin'?equal(sha(password),sha(ADMIN_PASSWORD)):equal(derived,u.passwordHash));
    if(!valid) return reply({ok:false,error:'نام کاربری یا رمز اشتباه است، یا حساب غیرفعال شده است.'},401,{key:attemptKey,value:{count:attempt.count+1,until:attempt.until}});
    const token=crypto.randomBytes(32).toString('hex'), expiresAt=now+8*60*60*1000;
    return reply({ok:true,token,expiresAt,user:publicUser(u)},200,{key:'session:'+sha(token),value:{username:u.username,version:u.version,expiresAt}});
  }
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)) fail('برای ادامه وارد شوید.',401);
  const sessionKey='session:'+sha(body.token), session=records.get(sessionKey);
  const user=session && userRecord(session.username);
  if(!session||session.expiresAt<=now||!user?.active||user.version!==session.version) fail('نشست پایان یافته یا دسترسی لغو شده است؛ دوباره وارد شوید.',401);
  const admin=()=>{if(user.role!=='admin')fail('این عملیات فقط برای سوپرادمین است.',403);};
  const courseRecord=id=>{const row=records.get('course:'+id);if(!row?.published)fail('این دوره منتشر نشده یا از دسترس خارج شده است.',404);return row;};
  const ownedProgress=id=>records.get('progress:'+user.username+':'+id)?.progress||emptyProgress();
  if(body.action==='me') return reply({ok:true,user:publicUser(user)});
  if(body.action==='logout') return reply({ok:true},200,{key:sessionKey,value:{...session,expiresAt:0}});
  if(body.action==='courses') {
    const courses=[...records.entries()].filter(([key,v])=>key.startsWith('course:')&&v.published).map(([,v])=>({...v.course,progress:ownedProgress(v.course.id)}));
    return reply({ok:true,courses});
  }
  if(body.action==='publish') {
    admin(); const c=body.course;
    if(!c||c.version!==1||typeof c.id!=='string'||!c.id||c.id.length>100||typeof c.title!=='string'||!Array.isArray(c.modules)||!c.modules.length||!Array.isArray(c.sources)||!Array.isArray(c.slides)) fail('فایل دوره معتبر نیست.');
    if(Buffer.byteLength(JSON.stringify(c),'utf8')>8*1024*1024) fail('حجم دوره برای انتشار در این نسخه بیشتر از ۸ مگابایت است؛ تصاویر جزوه را کوچک‌تر کنید.',413);
    const course=JSON.parse(JSON.stringify(c));course.progress=emptyProgress();
    const revision=sha(JSON.stringify(course));
    const previous=records.get('course:'+c.id);
    if(previous&&previous.revision!==revision&&[...records.keys()].some(k=>k.startsWith('progress:')&&k.endsWith(':'+c.id))) fail('این دوره پاسخ ثبت‌شده دارد؛ برای تغییر محتوای آن، نسخهٔ جدید با شناسهٔ جدید منتشر کنید.',409);
    return reply({ok:true,message:'دوره منتشر شد.'},200,{key:'course:'+c.id,value:{course,revision,published:true,publishedAt:new Date().toISOString()}});
  }
  if(body.action==='unpublish') {
    admin();const key='course:'+String(body.courseId),row=records.get(key);if(!row)fail('دوره پیدا نشد.',404);
    return reply({ok:true},200,{key,value:{...row,published:false}});
  }
  if(body.action==='users') {admin();return reply({ok:true,users:[...records.entries()].filter(([k])=>k.startsWith('user:')).map(([,v])=>publicUser(v))});}
  if(body.action==='createUser') {
    admin();const username=cleanUser(body.username),password=String(body.password||'');
    if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) fail('نام کاربری باید ۳ تا ۸۰ حرف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');
    if(userRecord(username)) fail('این نام کاربری قبلاً ثبت شده است.',409);
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
