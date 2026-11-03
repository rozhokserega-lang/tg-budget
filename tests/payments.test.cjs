const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
function setup() {
  let today = '2026-01-31';
  const demo = {member:{id:'m1'},categories:[{id:'food',name:'Еда',kind:'expense'}],tx:[]};
  const root = {Api:{isDemo:()=>true}, State:{get:()=>({categories:demo.categories})}, DEMO_API:{state:()=>demo}, Fmt:{todayIso:()=>today,parseAmount:s=>Number(String(s).replace(',','.')),money:n=>n+' ₽',escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
  const ctx = {window:root,console};
  for(const name of ['payments-calendar','payments-api','payments-views','payments'])runInNewContext(readFileSync(require.resolve('../src/'+name+'.js'),'utf8'),ctx);
  const invoke=(method,args={})=>root.PaymentsApi.invoke(method,{scope:'family',...args});
  const payment={name:'Подписка',amount:100,category_id:'food',date:'2026-01-31',repeat:{unit:'month',interval:1},reminders:[7,1],overdue_every:2};
  return {root,demo,invoke,payment,today:s=>{today=s}};
}
test('calendar retains monthly/yearly anchors, handles custom intervals and leap years',()=>{
  const {root}=setup(), c=root.PaymentsCalendar;
  assert.equal(JSON.stringify(c.dates({date:'2026-01-31',repeat:{unit:'month',interval:1}},'2026-04-30')),JSON.stringify(['2026-01-31','2026-02-28','2026-03-31','2026-04-30']));
  assert.equal(c.dates({date:'2024-02-29',repeat:{unit:'year',interval:1}},'2028-03-01').at(-1),'2028-02-29');
  for(const unit of ['day','week','month','year'])assert.equal(c.dates({date:'2026-01-01',repeat:{unit,interval:2}},'2026-01-01').length,1);
  assert.equal(c.cells('2026-02').length,35);assert.equal(c.shift('2026-01',-1),'2025-12');
  assert.equal(c.valid('2026-02-29'),false); assert.equal(c.valid('2024-02-29'),true);
});
test('confirm is atomic and idempotent by occurrence even with two partner request keys',async()=>{
  const {invoke,payment,demo}=setup();await invoke('save',{payment});
  let list=await invoke('list',{month:'2026-02'}),o=list.occurrences[0];
  const q={occurrence_id:o.id,amount:75,paid_on:'2026-01-30',category_id:'food'};
  const [a,b]=await Promise.all([invoke('confirm',{...q,idempotency_key:'partner-a'}),invoke('confirm',{...q,scope:'partner-b:family',idempotency_key:'partner-b'})]);
  assert.equal(a.transaction.id,b.transaction.id);assert.equal(demo.tx.length,1);assert.equal(demo.tx[0].is_shared,true);
  list=await invoke('list',{month:'2026-02'});assert.equal(list.occurrences.length,1);assert.equal(list.occurrences[0].amount,100);
});
test('failed confirm creates no expense and unpaid one-off vanishes only after success',async()=>{
  const {invoke,payment,demo}=setup(); await invoke('save',{payment:{...payment,repeat:null}});
  const o=(await invoke('list',{month:'2026-02'})).occurrences[0];
  await assert.rejects(invoke('confirm',{occurrence_id:o.id,amount:10,paid_on:'2026-02-30',category_id:'food'}));assert.equal(demo.tx.length,0);
  await invoke('confirm',{occurrence_id:o.id,amount:10,paid_on:'2026-01-31',category_id:'food'});
  assert.equal((await invoke('list',{month:'2026-02'})).occurrences.length,0);
});
test('overdue survives later periods, edit, pause and resume without paused-period backfill',async()=>{
  const {invoke,payment,today}=setup(); const p=await invoke('save',{payment});
  today('2026-02-10');await invoke('pause',{id:p.id,paused:true});
  today('2026-04-10');let data=await invoke('list',{month:'2026-04'});assert.equal(data.occurrences.length,1);assert.equal(data.occurrences[0].due_on,'2026-01-31');
  await invoke('save',{payment:{...payment,id:p.id,amount:200}});
  await invoke('pause',{id:p.id,paused:false}); data=await invoke('list',{month:'2026-05'});
  assert.equal(JSON.stringify(data.occurrences.map(o=>[o.due_on,o.amount])),JSON.stringify([['2026-01-31',100],['2026-04-30',200],['2026-05-31',200]]));
});
test('remove keeps recorded expenses and scopes isolate definitions',async()=>{
  const {invoke,payment,demo}=setup();const p=await invoke('save',{payment});
  const o=(await invoke('list',{month:'2026-01'})).occurrences[0];
  await invoke('confirm',{occurrence_id:o.id,amount:100,paid_on:'2026-01-31',category_id:'food'});
  await invoke('remove',{id:p.id});assert.equal(demo.tx.length,1);assert.equal((await invoke('list',{month:'2026-03'})).occurrences.length,0);
  assert.equal((await invoke('list',{scope:'other',month:'2026-01'})).payments.length,0);
});
test('production never calls a speculative endpoint or falls back after real adapter errors',async()=>{
  const {root,invoke}=setup();root.Api.isDemo=()=>false;assert.equal(root.PaymentsApi.available(),false);
  await assert.rejects(invoke('list',{month:'2026-01'}),/ожидает/);
  root.APP_PAYMENTS_ADAPTER={list:()=>Promise.reject(Error('offline'))}; await assert.rejects(invoke('list'),/offline/);
});
test('calendar escapes names and renders independent mixed status dots and total',()=>{
  const {root}=setup();const html=root.PaymentsViews.calendar({month:'2026-02',selected:'2026-02-28',data:{payments:[],occurrences:[{id:'1',payment_id:'p',due_on:'2026-02-28',amount:100,name:'<script>x</script>'},{id:'2',payment_id:'q',due_on:'2026-02-28',amount:20,status:'paused',name:'Other'}]}});
  assert.match(html,/120 ₽/);assert.match(html,/payment-dot--planned/);assert.match(html,/payment-dot--paused/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('validation rejects invalid recurrence, reminders, money and dates',()=>{
 const {root,payment}=setup();for(const patch of [{amount:NaN},{amount:0},{amount:1.001},{repeat:{unit:'day',interval:0}},{reminders:[NaN]},{overdue_every:0},{date:'2026-02-30'}])assert.throws(()=>root.PaymentsApi.validate({...payment,...patch}));
});
test('controller ignores stale months and blocks duplicate submits with stable retry keys',async()=>{
  const {root,payment}=setup();let resolveFirst, calls=[], html='', active=true, data, formError={textContent:''};
  root.APP_PAYMENTS_ADAPTER={list:q=>q.month==='2026-01'?new Promise(r=>resolveFirst=r):Promise.resolve({payments:[],occurrences:[]}),confirm:q=>{calls.push(q);return Promise.reject(Error('offline'));}};
  const host={scope:()=> 'family',active:()=>active,render:s=>{html=s},enter(){},load:(key,fn)=>fn(),categories:()=>Promise.resolve([]),sheet(){},close(){},lock(){},toast(){},confirm:()=>Promise.resolve(true),expired:()=>false,invalidate(){}};
  const c=root.Payments.create(host);const first=c.open();await Promise.resolve();
  await c.action('payment-month',{getAttribute:()=>1});resolveFirst({payments:[],occurrences:[{id:'old',name:'STALE',due_on:'2026-02-01',amount:1}]});await first;assert.doesNotMatch(html,/STALE/);
  const submit={disabled:false},form={isConnected:true,elements:{amount:{value:'10'},paid_on:{value:'2026-01-31'},category_id:{value:'food'}},getAttribute:()=> 'occurrence-1',querySelector:s=>s==='[type="submit"]'?submit:formError,setAttribute(){},removeAttribute(){}};
  const a=c.submit(form,true),b=c.submit(form,true);await Promise.all([a,b]);assert.equal(calls.length,1);const key=calls[0].idempotency_key;
  await c.submit(form,true);assert.equal(calls[1].idempotency_key,key);assert.equal(submit.disabled,false);assert.match(formError.textContent,/offline/);
});
test('edit keeps the opened version through refresh and rejects a form from another family',async()=>{
  const {root,payment}=setup();let scope='family-a',version=4,saved=[],error={textContent:''};
  root.APP_PAYMENTS_ADAPTER={list:async()=>({payments:[{...payment,id:'template',server:{version}}],occurrences:[]}),save:async q=>{saved.push(q);throw Error('offline')}};
  const c=root.Payments.create({scope:()=>scope,active:()=>true,render(){},enter(){},load:(key,fn)=>fn(),categories:async()=>[],sheet(){},close(){},lock(){},toast(){},expired:()=>false,invalidate(){}});
  await c.open();await c.action('payment-edit',{getAttribute:()=> 'template'});version=5;await c.refresh();
  const submit={disabled:false},elements={};
  for(const [k,v] of Object.entries({name:'Changed',description:'',amount:'100',category_id:'food',date:'2026-01-31',type:'once',reminders:'',overdue_every:''}))elements[k]={value:v};
  const form={isConnected:true,elements,getAttribute:()=> 'template',querySelector:s=>s==='[type="submit"]'?submit:error,setAttribute(){},removeAttribute(){}};
  await c.submit(form,false);assert.equal(saved[0].payment.server.version,4);
  scope='family-b';await c.submit(form,false);assert.equal(saved.length,1);assert.match(error.textContent,/Семья изменилась/);
});
