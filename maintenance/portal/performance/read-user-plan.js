const rows=$input.all().map(i=>i.json);
const session=rows.find(r=>typeof r.key==='string'&&r.key.startsWith('session:'));
let key='';
if(session)try{const s=JSON.parse(session.value);if(s.expiresAt>Date.now()&&typeof s.username==='string')key='user:'+s.username;}catch{}
return [{json:{lookup:Boolean(key),key}}];