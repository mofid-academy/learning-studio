const crypto=require('crypto');
const body=$('Portal Webhook').first().json.body||{};
const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const username=String(body.username||'').normalize('NFKC').trim().toLowerCase();
const keys=body.action==='login'?['user:'+username,'attempt:'+sha(username)]:['session:'+sha(body.token||'')];
return [{json:{key0:keys[0],key1:keys[1]||'__no_portal_record__'}}];