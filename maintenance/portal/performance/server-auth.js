// n8n Code node: Run Once for All Items. Keep this configuration in n8n only.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'CHANGE_THIS_TO_A_LONG_PRIVATE_PASSWORD';
const crypto = require('crypto');
const input = $('Portal Webhook').first().json;
const body = input.body || {};
const records = new Map();
const authItems=[...$('Load Login or Session').all(),...($('Load Session User').isExecuted?$('Load Session User').all():[])];
for (const item of authItems) {
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
    return reply({ok:true,protocol:2,features:{adminStorage:true},token,expiresAt,user:publicUser(u)},200,{key:'session:'+sha(token),value:{username:u.username,version:u.version,expiresAt}});
  }
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)) fail('برای ادامه وارد شوید.',401);
  const sessionKey='session:'+sha(body.token), session=records.get(sessionKey);
  const user=session && userRecord(session.username);
  if(!session||session.expiresAt<=now||!user?.active||user.version!==session.version) fail('نشست پایان یافته یا دسترسی لغو شده است؛ دوباره وارد شوید.',401);
  const admin=()=>{if(user.role!=='admin')fail('این عملیات فقط برای سوپرادمین است.',403);};
  const courseRecord=id=>{const row=records.get('course:'+id);if(!row?.published)fail('این دوره منتشر نشده یا از دسترس خارج شده است.',404);return row;};
  const ownedProgress=id=>records.get('progress:'+user.username+':'+id)?.progress||emptyProgress();
  if(body.action==='me') return reply({ok:true,protocol:2,features:{adminStorage:true},user:publicUser(user)});
  if(body.action==='logout') return reply({ok:true},200,{key:sessionKey,value:{...session,expiresAt:0}});

  const administrative=['publish','unpublish','users','createUser','updateUser','reports','adminCatalog','adminCourse','saveCourse','archiveCourse'];
  if(administrative.includes(body.action))admin();
  const exact=key=>({op:'eq',value:key,ceiling:key+'\uffff'});
  const prefix=value=>({op:'gte',value,ceiling:value+'\uffff'});
  const id=String(body.courseId||body.course?.id||'');
  let queries;
  if(body.action==='adminCatalog')queries=[prefix('course:'),prefix('draft:')];
  else if(['adminCourse','saveCourse','archiveCourse'].includes(body.action)||(body.action==='images'&&body.editor===true&&user.role==='admin'))queries=[exact('course:'+id),exact('draft:'+id)];
  else if(['courses','catalog'].includes(body.action))queries=[prefix('course:'),prefix('progress:'+user.username+':')];
  else if(['course','images','progress','unpublish'].includes(body.action))queries=[exact('course:'+id),exact('progress:'+user.username+':'+id)];
  else if(body.action==='publish')queries=[exact('course:'+id),prefix('progress:')];
  else if(body.action==='users')queries=[prefix('user:')];
  else if(['createUser','updateUser'].includes(body.action))queries=[exact('user:'+cleanUser(body.username))];
  else if(body.action==='reports')queries=[prefix('progress:'),prefix('course:')];
  else fail('عملیات ناشناخته است.',400);
  return [{json:{needsRecords:true,authorized:true,user:publicUser(user),adminUsername:adminUser.username,queries}}];
} catch(e) { return reply({ok:false,error:e.status?e.message:'پردازش درخواست انجام نشد؛ اجرای n8n را بررسی کنید.'},e.status||500); }
