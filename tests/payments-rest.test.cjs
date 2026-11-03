const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
function setup(handler) {
  const calls = [];
  const root = { Api: {url:'https://example.test/functions/v1/api/',isDemo:()=>false,ApiError:Error}, Tg:{initData:()=> 'signed-telegram'}, Fmt:{todayIso:()=> '2026-11-03'}, fetch:async (url,options)=>{
    calls.push({url,...options,body:options.body && JSON.parse(options.body)});
    const response = await handler(url,options);
    return {ok:response.status === undefined || response.status < 400,status:response.status || 200,text:async()=>response.raw === undefined ? JSON.stringify(response.data) : response.raw};
  }};
  for (const name of ['payments-calendar','payments-rest','payments-api']) runInNewContext(readFileSync(require.resolve('../src/'+name+'.js'),'utf8'),{window:root,URLSearchParams});
  return {root,calls,invoke:(method,q)=>root.PaymentsApi.invoke(method,q)};
}
const template = {id:'template-uuid',title:'Интернет',description:null,plannedAmount:500,categoryId:'category-uuid',firstDueDate:'2026-11-05',recurrenceRule:{frequency:'monthly',interval:1,timezone:'Europe/Moscow'},timezone:'Europe/Moscow',currency:'RUB',notificationRules:[{offsetMinutes:1440,time:'09:30'}],overdueNotificationRule:{everyDays:3,maxCount:8,time:'11:00'},status:'active',version:4};
const page = (data,nextCursor=null)=>({data:{data,pageInfo:{hasMore:!!nextCursor,nextCursor}}});
test('real adapter loads all template and occurrence pages, retains UUIDs and hides paid rows',async()=>{
  const {root,calls,invoke}=setup(async url=>{
    root.Tg.initData=()=> 'changed-session';
    if(url.includes('/payment-templates')) return page([{...template,status:'paused'},{...template,id:'future-template',firstDueDate:'2028-01-01'}]);
    if(url.includes('cursor=')) return page([{id:'paid',templateId:template.id,dueDate:'2026-11-03',plannedAmount:500,status:'paid'}]);
    return page([{id:'occurrence-uuid',templateId:template.id,dueDate:'2026-10-05',plannedAmount:450,status:'overdue',payment:{title:template.title,categoryId:template.categoryId}}],'next+/=');
  });
  const result=await invoke('list',{scope:'member:household',month:'2026-11'});
  assert.equal(result.payments.length,2);assert.equal(result.payments[0].paused,true);assert.equal(result.occurrences.length,1);
  assert.equal(result.occurrences[0].id,'occurrence-uuid');assert.equal(result.occurrences[0].amount,450);
  assert.ok(calls.some(c=>c.url.includes('from=2026-11-01&to=2026-11-30')));
  assert.ok(calls.some(c=>c.url.includes('cursor=next%2B%2F%3D')));
  for(const c of calls){assert.equal(c.headers.authorization,'tma signed-telegram');assert.equal(c.body,undefined);assert.ok(!c.url.includes('household'));}
});
test('edit sends only changed fields and version, preserving recurrence and notification settings',async()=>{
  const {root,calls,invoke}=setup(async url=>url.includes('/payment-templates')?page([template]):url.includes('?')?page([]):{data:template});
  const p=(await invoke('list',{month:'2026-11'})).payments[0];
  await invoke('save',{payment:{...p,name:'Новое название'}});
  const req=calls.at(-1);assert.equal(req.method,'PATCH');assert.deepEqual(req.body,{title:'Новое название',version:4});
  await invoke('save',{payment:{...p,overdue_every:2,reminders:[1,2]}});
  assert.equal(calls.at(-1).body.overdueNotificationRule.maxCount,8);assert.equal(calls.at(-1).body.overdueNotificationRule.time,'11:00');
  assert.deepEqual(calls.at(-1).body.notificationRules,[{offsetMinutes:1440,time:'09:30'},{offsetMinutes:2880,time:'10:00'}]);
  assert.ok(root.PaymentsApi.available());
});
test('create maps UI fields to contract without trusting scope, confirm is a single request',async()=>{
  const {calls,invoke}=setup(async()=>({data:template}));
  await invoke('save',{scope:'untrusted',payment:{name:'Аренда',amount:100,date:'2026-11-05',category_id:'cat',repeat:{unit:'year',interval:2},reminders:[0,7],overdue_every:3}});
  assert.equal(calls[0].method,'POST');assert.equal(calls[0].body.recurrenceRule.frequency,'yearly');assert.equal(calls[0].body.notificationRules[1].offsetMinutes,10080);assert.equal(calls[0].body.overdueNotificationRule.maxCount,5);assert.equal(calls[0].body.scope,undefined);
  const confirmed=setup(async()=>({data:{occurrenceId:'occ',expenseId:'expense'}}));
  const result=await confirmed.invoke('confirm',{occurrence_id:'occ',amount:90,paid_on:'2026-11-03',category_id:'cat',idempotency_key:'stable-retry-key'});
  assert.equal(confirmed.calls.length,1);assert.equal(confirmed.calls[0].headers['idempotency-key'],'stable-retry-key');
  assert.deepEqual(confirmed.calls[0].body,{actualAmount:90,actualDate:'2026-11-03',categoryId:'cat'});assert.equal(result.expense_id,'expense');
});
test('pause/resume and delete use real endpoints, errors never fall back to demo',async()=>{
  const {calls,invoke}=setup(async()=>({data:template}));
  await invoke('pause',{id:'id',paused:true});await invoke('pause',{id:'id',paused:false});await invoke('remove',{id:'id'});
  assert.ok(calls[0].url.endsWith('/id/pause'));assert.ok(calls[1].url.endsWith('/id/resume'));assert.equal(calls[2].method,'DELETE');
  const denied=setup(async()=>({status:401,data:{error:{code:'UNAUTHORIZED',message:'Invalid'}}}));
  await assert.rejects(denied.invoke('remove',{id:'id'}),e=>e.code==='UNAUTHORIZED' && e.status===401);
  const offline=setup(async()=>{throw Error('offline')});await assert.rejects(offline.invoke('remove',{id:'id'}),e=>e.code==='network');
});
test('broken JSON and repeated pagination cursors reject instead of returning partial data',async()=>{
  const broken=setup(async()=>({raw:'not json'}));await assert.rejects(broken.invoke('list',{month:'2026-11'}),e=>e.code==='invalid_json');
  const repeated=setup(async()=>page([], 'same'));await assert.rejects(repeated.invoke('list',{month:'2026-11'}),e=>e.code==='invalid_json');
});
test('validation follows server title, recurrence and notification limits',()=>{
  const {root}=setup(async()=>({data:{}}));const p={name:'OK',description:'',amount:1,category_id:'cat',date:'2026-11-01',repeat:null,reminders:[],overdue_every:null};
  for(const change of [{name:'x'.repeat(121)},{description:'x'.repeat(1001)},{amount:1e9+1},{repeat:{unit:'month',interval:13}},{repeat:{unit:'year',interval:11}},{reminders:[31]},{overdue_every:31}])assert.throws(()=>root.PaymentsApi.validate({...p,...change}));
});
test('calendar keeps different currencies separate',()=>{
  const {root}=setup(async()=>({data:{}}));root.Fmt.escapeHtml=s=>String(s);root.Fmt.money=n=>String(n);
  runInNewContext(readFileSync(require.resolve('../src/payments-views.js'),'utf8'),{window:root,Intl});
  const html=root.PaymentsViews.calendar({month:'2026-11',selected:'2026-11-03',data:{payments:[],occurrences:[{id:'a',name:'A',due_on:'2026-11-03',amount:100,currency:'USD'},{id:'b',name:'B',due_on:'2026-11-03',amount:200,currency:'EUR'}]}});
  assert.match(html,/100.*\$.*\/.*200.*€/);assert.doesNotMatch(html,/300/);
});
