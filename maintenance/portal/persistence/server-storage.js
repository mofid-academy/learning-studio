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
