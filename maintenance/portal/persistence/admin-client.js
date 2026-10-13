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
