const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
function setup(){const root={Api:{isDemo:()=>true},Fmt:{todayIso:()=> '2026-11-03',escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')}};for(const n of ['tasks-model','tasks-api','tasks-views','tasks'])runInNewContext(readFileSync(require.resolve('../src/'+n+'.js'),'utf8'),{window:root});let key=0;return {root,call:(method,q={})=>root.TasksApi.invoke(method,{scope:'u1:family',idempotency_key:'k'+ ++key,...q}),task:{title:'Test',description:'',list_id:null,due_on:'2026-01-31',priority:'normal',repeat:null,reminders:[]}};}
test('private scope, idempotent creation, deleting lists preserves active and completed tasks',async()=>{const {call,task}=setup();await call('saveList',{name:'Дом'});const id=(await call('list')).lists[0].id;await call('save',{task:{...task,list_id:id},idempotency_key:'same'});await call('save',{task:{...task,list_id:id},idempotency_key:'same'});let s=await call('list');assert.equal(s.tasks.length,1);assert.equal((await call('list',{scope:'u2:family'})).tasks.length,0);await call('complete',{id:s.tasks[0].id});await call('removeList',{id});s=await call('list');assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].list_id,null);assert.ok(s.tasks[0].completed_at);});
test('completion/restore retains fields, resets retention and never duplicates next occurrence',async()=>{const {call,task}=setup();await call('save',{task:{...task,repeat:{unit:'month',interval:1,weekdays:[]},reminders:[60]}});const id=(await call('list')).tasks[0].id;await Promise.all([call('complete',{id}),call('complete',{id})]);let s=await call('list');assert.equal(s.tasks.length,2);assert.equal(s.tasks[1].due_on,'2026-02-28');assert.equal(Date.parse(s.tasks[0].delete_after)-Date.parse(s.tasks[0].completed_at),30*86400000);await call('restore',{id});s=await call('list');assert.equal(s.tasks[0].delete_after,null);assert.equal(s.tasks[0].reminders[0],60);await call('complete',{id});s=await call('list');assert.equal(s.tasks.length,2);await call('complete',{id:s.tasks[1].id});assert.equal((await call('list')).tasks[2].due_on,'2026-03-31');});
test('recurrence intervals, weekly weekdays, leap anchor and invalid input',()=>{const {root,task}=setup(),M=root.TasksModel;assert.equal(M.nextDate({...task,due_on:'2026-11-02',repeat:{unit:'week',interval:2,weekdays:[1,3]}}),'2026-11-04');assert.equal(M.nextDate({...task,due_on:'2026-11-04',repeat:{unit:'week',interval:2,weekdays:[1,3]}}),'2026-11-16');assert.equal(M.nextDate({...task,due_on:'2024-02-29',repeat:{unit:'year',interval:1,weekdays:[]}}),'2025-02-28');assert.throws(()=>M.validate({...task,due_on:'2026-02-30'}));assert.throws(()=>M.validate({...task,due_on:null,reminders:[60]}));});
test('sorting groups overdue only in all and persists independent view orders/settings',async()=>{const {root,call,task}=setup();await call('save',{task:{...task,title:'Late',due_on:'2026-11-01'}});await call('save',{task:{...task,title:'Future',due_on:'2026-12-01',priority:'important'}});let data=await call('list');const ids=data.tasks.map(t=>t.id);await call('preferences',{view:'all',order:[ids[1],ids[0]],sort:'manual',selected:'none'});await call('preferences',{view:'none',order:ids});data=await call('list');assert.equal(data.preferences.orders.all[0],ids[1]);assert.equal(data.preferences.orders.none[0],ids[0]);const s={data,sort:'priority',selected:'all',completed:false};assert.equal(root.TasksModel.rows(s,'2026-11-03')[0].title,'Late');s.selected='none';assert.equal(root.TasksModel.rows(s,'2026-11-03')[0].title,'Future');s.sort='due';assert.equal(root.TasksModel.rows(s,'2026-11-03')[0].title,'Late');s.sort='created';assert.equal(root.TasksModel.rows(s,'2026-11-03').length,2);});
test('production has no mock fallback and titles escape HTML',async()=>{const {root,call,task}=setup();await call('save',{task:{...task,title:'<img onerror=x>'}});const data=await call('list');assert.ok(root.TasksViews.page({data,selected:'all',sort:'due',completed:false}).includes('&#60;img'));root.Api.isDemo=()=>false;assert.equal(root.TasksApi.available(),false);await assert.rejects(call('list'));});
test('controller ignores delayed reads from another user',async()=>{const {root}=setup();let scope='a',resolve,paints=[];root.APP_TASKS_ADAPTER={list:()=>new Promise(r=>{resolve=r;})};const c=root.Tasks.create({scope:()=>scope,active:()=>true,enter(){},render:h=>paints.push(h),load:(k,loader)=>loader()});const pending=c.open();await Promise.resolve();scope='b';resolve({lists:[],tasks:[{id:'secret',title:'PRIVATE'}],preferences:{selected:'all',sort:'due',orders:{}}});await pending;assert.equal(paints.join('').includes('PRIVATE'),false);});
test('task and list forms retain opened versions and stable creation keys through retry',async()=>{
 const {root,task}=setup();let version=7,captured=[],errors={textContent:''};
 root.APP_TASKS_ADAPTER={list:async()=>({lists:[],tasks:[{...task,id:'t',server:{version}}],preferences:{selected:'all',sort:'due',orders:{}}}),save:async q=>{captured.push(q);throw Error('offline');},saveList:async q=>{captured.push(q);throw Error('offline');}};
 const c=root.Tasks.create({scope:()=> 'u1:family',active:()=>true,enter(){},render(){},load:(k,f)=>f(),sheet(){},close(){},toast(){},lock(){},invalidate(){},expired:()=>false});
 await c.open();await c.action('task-edit',{getAttribute:()=> 't'});version=8;await c.refresh();
 const elements={};for(const [k,v] of Object.entries({title:'Changed',description:'',list_id:'none',due_on:'2030-01-31',priority:'normal',unit:'',interval:'1',reminders:''}))elements[k]={value:v};
 const form={elements,isConnected:true,getAttribute:()=> 't',querySelectorAll:()=>[],querySelector:s=>s==='[type="submit"]'?{disabled:false}:errors};
 await c.submit(form,false);assert.equal(captured[0].task.server.version,7);
 await c.action('task-list-new',{getAttribute:()=>null});const listForm={...form,elements:{name:{value:'New'}},getAttribute:()=>''};
 await c.submit(listForm,true);await c.submit(listForm,true);assert.ok(captured[1].idempotency_key);assert.equal(captured[1].idempotency_key,captured[2].idempotency_key);
});

test('home plan excludes future/undated/deleted, deduplicates, sorts overdue then important and counts original due dates',()=>{
 const {root,task}=setup();const today='2026-11-03';
 const make=(id,due_on,extra={})=>({...task,id,due_on,...extra});
 const data={tasks:[make('normal',today),make('important',today,{priority:'important'}),make('late','2026-11-01'),make('done',today,{completed_at:'2026-11-03T10:00:00Z'}),make('late-done','2026-11-01',{completed_at:'2026-11-03T10:00:00Z'}),make('future','2026-11-04'),make('none',null),make('deleted',today,{deleted_at:'x'}),make('done',today,{completed_at:'x'})]};
 const m=root.TasksModel.todayPlan(data,today);
 assert.deepEqual(Array.from(m.rows,t=>t.id),['late','important','normal']);assert.equal(m.total,3);assert.equal(m.done,1);assert.equal(m.percent,33);
 assert.equal(root.TasksModel.todayPlan(data,'2026-11-04').total,1);
 const html=root.TasksViews.today({data});assert.match(html,/Осталось 2 из 3/);assert.match(html,/module-open/);assert.match(html,/Просрочена/);
});
test('home displays at most four tasks, safe titles and distinct free/completed/error states',()=>{
 const {root,task}=setup();let tasks=Array.from({length:8},(_,i)=>({...task,id:''+i,title:'<b>unsafe</b>',due_on:'2026-11-03'}));
 let html=root.TasksViews.today({data:{tasks}});assert.equal((html.match(/data-task-complete=/g)||[]).length,4);assert.match(html,/Все задачи \(8\)/);assert.ok(!html.includes('<b>unsafe'));
 assert.match(root.TasksViews.today({data:{tasks:[]}}),/всё свободно/);
 tasks=tasks.map(t=>({...t,completed_at:'2026-11-03T12:00:00Z'}));html=root.TasksViews.today({data:{tasks}});assert.match(html,/выполнены!/);assert.match(html,/aria-valuenow="100"/);
 assert.match(root.TasksViews.today({data:null,error:'offline'}),/Не удалось загрузить/);
});
test('home and tracker share snapshot; completion refreshes repeat once and retries errors with stable key',async()=>{
 const {root,task,call}=setup();await call('save',{task:{...task,due_on:'2026-11-03',repeat:{unit:'day',interval:1,weekdays:[]}}});
 let homePaints=0,toasts=[],reads=0;const c=root.Tasks.create({scope:()=> 'u1:family',active:()=>false,enter(){},paintHome(){homePaints++;},render(){},load:(k,f)=>{reads++;return f();},lock(){},expired:()=>false,invalidate(){},toast:m=>toasts.push(m)});
 await Promise.all([c.loadHome(),c.loadHome()]);assert.equal(reads,1);
 let data=await call('list'),id=data.tasks[0].id;const node={hasAttribute:()=>true,getAttribute:()=>id};
 await Promise.all([c.change(node),c.change(node)]);data=await call('list');assert.equal(data.tasks.length,2);assert.ok(data.tasks[0].completed_at);assert.match(c.homeHtml(),/выполнены!/);assert.ok(homePaints>0);
 let keys=[];root.APP_TASKS_ADAPTER={list:async()=>({lists:[],tasks:[{...task,id:'fail',due_on:'2026-11-03'}],preferences:{selected:'all',sort:'due',orders:{}}}),complete:async q=>{keys.push(q.idempotency_key);throw Error('offline');}};
 await c.refresh();const failNode={hasAttribute:()=>true,getAttribute:()=> 'fail'};await c.change(failNode);await c.change(failNode);assert.equal(keys[0],keys[1]);assert.equal(toasts.at(-1),'offline');assert.match(c.homeHtml(),/data-task-complete="fail"/);
});
