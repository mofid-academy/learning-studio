function mofidUpdateWorkflow(original,optimized){
 const copy=value=>JSON.parse(JSON.stringify(value));
 const result=copy(original);
 if(!Array.isArray(result.nodes)||!result.connections)throw Error('فایل، خروجی معتبر ورک‌فلوی n8n نیست.');
 const hooks=result.nodes.filter(n=>n.type==='n8n-nodes-base.webhook'&&n.parameters?.path==='mofid-learning-portal');
 if(hooks.length!==1)throw Error('یک وبهوک با مسیر mofid-learning-portal باید در فایل وجود داشته باشد.');
 const oldNames=new Set(),pending=[hooks[0].name],byName=new Map(result.nodes.map(n=>[n.name,n]));
 while(pending.length){
  const name=pending.pop();if(oldNames.has(name))continue;
  const node=byName.get(name);if(!node)throw Error('اتصال به نود ناموجود در ورک‌فلوی فعلی وجود دارد.');
  if(node.type.includes('langchain')||(node.type==='n8n-nodes-base.webhook'&&name!==hooks[0].name))throw Error('شاخهٔ Portal به شاخهٔ هوش مصنوعی متصل است؛ جایگزینی خودکار متوقف شد.');
  oldNames.add(name);
  for(const outputs of Object.values(result.connections[name]||{}))for(const output of outputs)for(const edge of output)pending.push(edge.node);
 }
 for(const [name,connection] of Object.entries(result.connections)){
  if(oldNames.has(name))continue;
  for(const outputs of Object.values(connection))for(const output of outputs)for(const edge of output)if(oldNames.has(edge.node))throw Error('یکی از نودهای Portal بین چند شاخه مشترک است؛ جایگزینی خودکار متوقف شد.');
 }
 const configNodes=result.nodes.filter(n=>oldNames.has(n.name)&&n.type==='n8n-nodes-base.code'&&/ADMIN_USERNAME\s*=/.test(n.parameters?.jsCode||'')&&/ADMIN_PASSWORD\s*=/.test(n.parameters?.jsCode||''));
 if(configNodes.length!==1)throw Error('نود تنظیم نام کاربری و رمز مدیر به‌صورت یکتا پیدا نشد.');
 const config=configNodes[0].parameters.jsCode;
 const literal=key=>{const re=new RegExp('^[ \\t]*(?:const|let|var)\\s+'+key+'\\s*=\\s*(\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*")\\s*;','m');const match=config.match(re);if(!match)throw Error('تنظیم '+key+' باید یک مقدار ثابت داخل کوتیشن باشد.');return match[1];};
 const username=literal('ADMIN_USERNAME'),password=literal('ADMIN_PASSWORD');
 const replacement=copy(optimized);
 const newHook=replacement.nodes.find(n=>n.name==='Portal Webhook');
 const hookName=newHook.name,hookPosition=newHook.position;
 Object.assign(newHook,copy(hooks[0]),{name:hookName,position:hookPosition});
 newHook.parameters.responseMode='responseNode';
 const auth=replacement.nodes.find(n=>n.name==='Portal API');
 const oldTable=result.nodes.find(n=>oldNames.has(n.name)&&n.type==='n8n-nodes-base.dataTable'&&n.parameters?.resource==='table'&&n.parameters?.operation==='create');
 if(!oldTable||typeof oldTable.parameters.tableName!=='string')throw Error('نود استفاده از جدول فعلی پیدا نشد؛ جایگزینی خودکار متوقف شد.');
 replacement.nodes.find(n=>n.name==='Ensure Portal Table').parameters=copy(oldTable.parameters);
 replacement.nodes.find(n=>n.name==='Ensure Portal Table').parameters.options={...oldTable.parameters.options,createIfNotExists:true};
 const oldReader=result.nodes.find(n=>oldNames.has(n.name)&&n.type==='n8n-nodes-base.dataTable'&&n.parameters?.operation==='get');
 if(oldReader?.parameters?.dataTableId?.mode==='id'&&typeof oldReader.parameters.dataTableId.value==='string'&&!oldReader.parameters.dataTableId.value.startsWith('=')){
  for(const node of replacement.nodes)if(node.type==='n8n-nodes-base.dataTable'&&node.parameters.resource==='row')node.parameters.dataTableId=copy(oldReader.parameters.dataTableId);
 }
 const kept=result.nodes.filter(n=>!oldNames.has(n.name)),usedNames=new Set(kept.map(n=>n.name)),usedIds=new Set(kept.map(n=>n.id)),rename=new Map();
 for(const node of replacement.nodes){let name=node.name;while(usedNames.has(name))name+=' v2';rename.set(node.name,name);usedNames.add(name);}
 function mapValue(value){
  if(typeof value==='string'){for(const [from,to] of rename){value=value.split("$('"+from+"')").join("$('"+to+"')");value=value.split('$("'+from+'")').join('$("'+to+'")');}return value;}
  if(Array.isArray(value))return value.map(mapValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,mapValue(v)]));return value;
 }
 for(const node of replacement.nodes){node.parameters=mapValue(node.parameters);node.name=rename.get(node.name);while(usedIds.has(node.id))node.id+='-v2';usedIds.add(node.id);}
 auth.parameters.jsCode=auth.parameters.jsCode.replace(/const ADMIN_USERNAME = '[^']*';/,()=> 'const ADMIN_USERNAME = '+username+';').replace(/const ADMIN_PASSWORD = '[^']*';/,()=> 'const ADMIN_PASSWORD = '+password+';');
 result.nodes=kept.concat(replacement.nodes);
 for(const name of oldNames)delete result.connections[name];
 for(const [name,connection] of Object.entries(replacement.connections))result.connections[rename.get(name)]=Object.fromEntries(Object.entries(connection).map(([type,outputs])=>[type,outputs.map(output=>output.map(edge=>({...edge,node:rename.get(edge.node)})))]));
 if(result.pinData)result.pinData=Object.fromEntries(Object.entries(result.pinData).filter(([name])=>!oldNames.has(name)));
 result.active=false;
 return result;
}
if(typeof module!=='undefined')module.exports=mofidUpdateWorkflow;
