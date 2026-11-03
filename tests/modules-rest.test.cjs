const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
function setup(handler){
 const calls=[],root={Api:{url:'https://fixture.test/api',ApiError:Error},Tg:{initData:()=> 'signed-A'}};
 root.fetch=async(url,options)=>{const q={url,...options,body:options.body?JSON.parse(options.body):undefined};calls.push(q);const r=await handler(q);return {ok:!r.status||r.status<400,status:r.status||200,text:async()=>r.raw===undefined?JSON.stringify(r.data):r.raw};};
 const TestIntl={DateTimeFormat:function(locale,options){return new Intl.DateTimeFormat(locale,{...options,timeZone:options&&options.timeZone||'UTC'});}};
 runInNewContext(readFileSync(require.resolve('../src/modules-rest.js'),'utf8'),{window:root,Intl:TestIntl});return {root,calls};
}
const page=(data,cursor)=>({data:{data,pageInfo:{hasMore:!!cursor,nextCursor:cursor||null}}});
const reminder={id:'r',title:'Event',description:null,startsAt:'2030-03-30T01:30:12.123Z',timezone:'Europe/Berlin',priority:'normal',recurrenceRule:{frequency:'daily',interval:1,weekdays:null,timezone:'Europe/Berlin'},notificationRules:[{offsetMinutes:60,time:null}],status:'active',version:4};
const task={id:'t',title:'Task',description:null,listId:null,dueAt:'2030-01-31T10:30:12.123Z',timezone:'UTC',priority:'normal',recurrenceRule:{frequency:'monthly',interval:1,weekdays:null,timezone:'UTC'},notificationRules:[{offsetMinutes:60,time:null}],seriesId:'series',createdAt:'2026-11-03T00:00:00Z',completedAt:null,deleteAfter:null,version:7};
test('reminders load full definitions including paused/no occurrences, all pages and captured auth',async()=>{
 const {root,calls}=setup(q=>{
  root.Tg.initData=()=> 'changed-session';
  if(q.url.includes('view=templates'))return q.url.includes('cursor=')?page([{...reminder,id:'paused',status:'paused'}]):page([reminder],'templates-next');
  return q.url.includes('cursor=')?page([{id:'paid',reminderId:'r',scheduledAt:'2030-03-31T01:30:00Z',status:'completed'}]):page([{id:'occ',reminderId:'r',reminder:{id:'r',title:'summary only'},scheduledAt:'2030-03-30T01:30:00Z',status:'pending'}],'events-next');
 });
 const data=await root.RemindersRest.list({from:'2030-03-01',until:'2030-03-31',timezone:'Europe/Berlin'});
 assert.equal(data.reminders.length,2);assert.equal(data.reminders[1].paused,true);assert.equal(data.reminders[0].time,'02:30');assert.equal(data.occurrences.length,1);assert.equal(data.occurrences[0].id,'occ');
 for(const c of calls)assert.equal(c.headers.authorization,'tma signed-A');assert.ok(calls.some(c=>c.url.includes('timezone=Europe%2FBerlin')));
});
test('editing preserves snapshot version, hidden time, rules and sends only changes',async()=>{
 const {root,calls}=setup(()=>({data:{}}));
 await root.RemindersRest.save({reminder:{id:'r',title:'Changed',description:'',date:'2030-03-30',time:'02:30',timezone:'Europe/Berlin',priority:'normal',repeat:{unit:'day',interval:1,weekdays:[]},notifications:[60],server:reminder}});
 assert.deepEqual(calls.at(-1).body,{title:'Changed',version:4});
 await root.TasksRest.save({task:{id:'t',title:'Changed',description:'',list_id:null,due_on:'2030-01-31',priority:'normal',repeat:{unit:'month',interval:1,weekdays:[]},reminders:[60],server:task}});
 assert.deepEqual(calls.at(-1).body,{title:'Changed',version:7});assert.ok(calls.at(-1).url.endsWith('?scope=series'));
 const once={...task,seriesId:null,recurrenceRule:null};
 await root.TasksRest.save({task:{id:'t',title:'Changed',description:'',list_id:null,due_on:'2030-01-31',priority:'normal',repeat:null,reminders:[60],server:once}});
 assert.ok(calls.at(-1).url.endsWith('?scope=instance'));
});
test('series changes are explicit and a single-instance edit cannot silently change recurrence',async()=>{
 const {root,calls}=setup(()=>({data:{}}));const t={id:'t',title:'Task',description:'',list_id:null,due_on:'2030-01-31',priority:'normal',repeat:null,reminders:[60],server:task};
 await root.TasksRest.save({task:t,edit_scope:'series'});assert.equal(calls[0].body.recurrenceRule,null);
 assert.throws(()=>root.TasksRest.save({task:t,edit_scope:'instance'}),e=>e.code==='VALIDATION_ERROR');assert.equal(calls.length,1);
});
test('DST conversion matches Berlin gap/fold and half-hour transition policy',async()=>{
 const {root,calls}=setup(()=>({data:{}}));
 for(const [date,time,timezone,expected] of [['2030-03-31','02:30','Europe/Berlin','2030-03-31T01:30:00.000Z'],['2030-10-27','02:30','Europe/Berlin','2030-10-27T00:30:00.000Z'],['2026-10-04','02:15','Australia/Lord_Howe','2026-10-03T15:45:00.000Z']]){
  await root.RemindersRest.save({reminder:{title:'Event',description:'',date,time,timezone,priority:'normal',repeat:null,notifications:[]},idempotency_key:'stable-create-key'});
  assert.equal(calls.at(-1).body.startsAt,expected);assert.equal(calls.at(-1).headers['idempotency-key'],'stable-create-key');
 }
});
test('task snapshot preserves separate view selection/orders and preferences write them back',async()=>{
 const {root,calls}=setup(q=>q.url.includes('/module-preferences')?{data:{selectedTaskView:'none',selectedTaskListId:null,taskSortMode:'manual',taskOrders:{all:['t'],none:[]}}}:page(q.url.includes('task-lists')?[{id:'list',title:'Private',version:2}]:q.url.includes('completed')?[]:[task]));
 const snapshot=await root.TasksRest.list();assert.equal(snapshot.preferences.selected,'none');assert.equal(snapshot.preferences.orders.all[0],'t');
 await root.TasksRest.preferences({selected:'none',view:'all',order:['t'],sort:'manual'});
 assert.deepEqual(calls.at(-1).body,{selectedTaskView:'none',selectedTaskListId:null,taskSortMode:'manual',taskOrders:{all:['t']}});
 await root.TasksRest.saveList({name:'New',idempotency_key:'list-stable-key'});assert.equal(calls.at(-1).headers['idempotency-key'],'list-stable-key');
});
test('errors keep code/status/details, network never falls back and delete retry tolerates 404',async()=>{
 const denied=setup(()=>({status:409,data:{error:{code:'CONFLICT',details:{reason:'VERSION_CONFLICT'}}}}));
 await assert.rejects(denied.root.TasksRest.complete({id:'t',idempotency_key:'complete-stable'}),e=>e.code==='CONFLICT'&&e.status===409&&e.details.reason==='VERSION_CONFLICT');
 const offline=setup(()=>{throw Error('offline');});await assert.rejects(offline.root.RemindersRest.remove({id:'r'}),e=>e.code==='network');
 const missing=setup(()=>({status:404,data:{error:{code:'NOT_FOUND'}}}));assert.equal((await missing.root.TasksRest.remove({id:'t'})).deleted,true);
});
