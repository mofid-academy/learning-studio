const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const sandbox={window:{},URL};
vm.runInNewContext(fs.readFileSync(path.join(root,'studio-routing.js'),'utf8'),sandbox);
const routing=sandbox.window.MofidStudioRouting;
const source=fs.readFileSync(path.join(root,'chunks/v2-39.txt'),'utf8');

test('public, administrator and legacy links choose the intended portal',()=>{
  assert.equal(routing.route('https://mofid-academy.github.io/learning-studio/').participant,true);
  assert.equal(routing.route('https://mofid-academy.github.io/learning-studio/?portal=participant').participant,true);
  assert.equal(routing.route('https://mofid-academy.github.io/learning-studio/admin.html').participant,false);
  assert.equal(routing.route('https://mofid-academy.github.io/learning-studio/?portal=admin').redirect,'https://mofid-academy.github.io/learning-studio/admin.html');
});

test('administrator and participant sessions remain isolated in the same browser tab',()=>{
  const values=new Map();
  const sessionStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  function client(participant){
    const document=routing.prepare(source,participant);
    const start=document.indexOf('function mfSessionRead()');
    const end=document.indexOf('async function mfApi(',start);
    const context={sessionStorage,mfClearContent(){}};
    vm.createContext(context);vm.runInContext(document.slice(start,end),context);
    return context;
  }
  const admin=client(false),student=client(true);
  admin.mfSessionSave({token:'admin-test-session',user:{role:'admin'}});
  assert.equal(student.mfSessionRead(),null);
  student.mfSessionSave({token:'participant-test-session',user:{role:'participant'}});
  assert.equal(admin.mfSessionRead().token,'admin-test-session');
  student.mfSessionClear();
  assert.equal(student.mfSessionRead(),null);
  assert.equal(admin.mfSessionRead().token,'admin-test-session');
});

test('a changed bundle cannot silently restore the old route or session behavior',()=>{
  assert.throws(()=>routing.prepare(source.replace("get('portal')","get('changed')"),true),/source mismatch/);
  assert.throws(()=>routing.prepare(source.replace("'mofid-portal-session'","'changed-session'"),false),/source mismatch/);
});
